-- Move the live wallet to KES and add client-referral agents.
-- Historical ad tables are renamed and retained for audit; they are no longer exposed to clients.

-- Some existing projects already have a `profiles` table from another app.
-- Add the ViewPay fields before the legacy points-to-KES conversion. Existing
-- `ai_credits` (or similar product credits) are not cash and are not converted.
alter table public.profiles add column if not exists country text not null default 'KE';
alter table public.profiles add column if not exists points integer not null default 0;
alter table public.profiles add column if not exists referral_code text;
alter table public.profiles add column if not exists referred_by uuid;
alter table public.profiles add column if not exists referral_rewarded boolean not null default false;
alter table public.profiles add column if not exists phone_number text;
alter table public.profiles add column if not exists phone_verified_at timestamptz;
alter table public.profiles add column if not exists device_lock_required boolean not null default false;
alter table public.profiles add column if not exists pending_device_id uuid;

update public.profiles
set referral_code = upper(substr(md5(id::text), 1, 8))
where referral_code is null or btrim(referral_code) = '';
alter table public.profiles alter column referral_code set not null;

drop function if exists public.complete_ad_view(uuid, integer);
drop function if exists public.start_ad_view(uuid);
drop function if exists public.daily_ad_limit();
drop function if exists public.request_payout(text, text, integer);

alter table public.profiles add column if not exists balance_kes numeric(14, 2) not null default 0;
update public.profiles set balance_kes = round(points * 0.2, 2);
alter table public.profiles drop column points;
alter table public.profiles drop column referral_rewarded;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'wallet_transactions'
      and column_name = 'points_delta'
  ) then
    execute $sql$
      update public.wallet_transactions
      set amount = case
            when points_delta <> 0 then round(points_delta * 0.2, 2)
            else coalesce(amount, 0)
          end,
          currency = 'KES'
    $sql$;
  else
    -- This project already stores wallet movements as amounts. Preserve them;
    -- there is no points value available to convert.
    update public.wallet_transactions set currency = 'KES';
  end if;
end $$;
alter table public.wallet_transactions drop column if exists points_delta;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payouts'
      and column_name = 'points'
  ) then
    execute 'update public.payouts set amount = round(points * 0.2, 2), currency = ''KES''';
  else
    -- Keep existing monetary amounts when this is already an amount-based schema.
    update public.payouts set currency = 'KES';
  end if;
end $$;
alter table public.payouts drop column if exists points;
alter table public.payouts drop constraint if exists payouts_currency_check;
alter table public.payouts add constraint payouts_currency_kes_only check (currency = 'KES');

alter table public.ads rename to legacy_ads;
alter table public.ad_views rename to legacy_ad_views;
revoke all on public.legacy_ads, public.legacy_ad_views from anon, authenticated;
grant all on public.legacy_ads, public.legacy_ad_views to service_role;

create table public.agent_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true,
  assigned_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.agent_client_commissions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agent_profiles(user_id) on delete restrict,
  client_id uuid not null references auth.users(id) on delete cascade,
  qualifying_claim_id uuid not null references public.task_claims(id) on delete restrict,
  amount_kes integer not null default 5 check (amount_kes = 5),
  credited_at timestamptz not null default now(),
  unique (client_id),
  unique (qualifying_claim_id)
);

create index agent_client_commissions_agent_date_idx
  on public.agent_client_commissions(agent_id, credited_at desc);

alter table public.agent_profiles enable row level security;
alter table public.agent_client_commissions enable row level security;
create policy agent_profile_read_self on public.agent_profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy agent_commissions_read_self on public.agent_client_commissions
  for select to authenticated using (agent_id = (select auth.uid()));
revoke all on public.agent_profiles, public.agent_client_commissions from anon, authenticated;
grant select on public.agent_profiles, public.agent_client_commissions to authenticated;
grant all on public.agent_profiles, public.agent_client_commissions to service_role;

create or replace function public.review_task_submission(
  _claim_id uuid,
  _decision text,
  _admin_note text default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_claim public.task_claims%rowtype;
  v_task public.tasks%rowtype;
  v_referrer uuid;
  v_commission_id uuid;
  v_first_approved boolean;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Administrator access is required'; end if;
  if _decision not in ('approved', 'rejected') then raise exception 'Choose approve or reject'; end if;
  if char_length(coalesce(_admin_note, '')) > 2000 then raise exception 'Review note is too long'; end if;
  select * into v_claim from public.task_claims where id = _claim_id for update;
  if not found or v_claim.status <> 'submitted' then raise exception 'This submission has already been reviewed'; end if;
  select * into v_task from public.tasks where id = v_claim.task_id for update;
  select not exists (
    select 1 from public.task_claims c
    where c.user_id = v_claim.user_id and c.status = 'approved'
  ) into v_first_approved;

  update public.task_claims set status = _decision, admin_note = nullif(btrim(_admin_note), ''), reviewed_at = now()
    where id = _claim_id;
  if _decision = 'rejected' then
    update public.tasks set claimed_count = greatest(0, claimed_count - 1), updated_at = now() where id = v_task.id;
    return;
  end if;

  update public.profiles set balance_kes = balance_kes + v_task.reward_kes
    where id = v_claim.user_id returning referred_by into v_referrer;
  insert into public.wallet_transactions(user_id, kind, amount, currency, reference_id, note)
    values (v_claim.user_id, 'task_reward', v_task.reward_kes, 'KES', v_claim.id::text, v_task.title);

  if v_first_approved and v_referrer is not null and exists (
    select 1 from public.agent_profiles a where a.user_id = v_referrer and a.active
  ) then
    insert into public.agent_client_commissions(agent_id, client_id, qualifying_claim_id)
      values (v_referrer, v_claim.user_id, v_claim.id)
      on conflict (client_id) do nothing returning id into v_commission_id;
    if v_commission_id is not null then
      update public.profiles set balance_kes = balance_kes + 5 where id = v_referrer;
      insert into public.wallet_transactions(user_id, kind, amount, currency, reference_id, note)
        values (v_referrer, 'agent_commission', 5, 'KES', v_commission_id::text, 'First approved task by referred client');
    end if;
  end if;
end $$;

create or replace function public.request_payout(_amount_kes numeric, _destination text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_country text;
  v_balance numeric(14, 2);
  v_destination text := regexp_replace(btrim(_destination), '[^0-9]', '', 'g');
  v_id uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if _amount_kes is null or _amount_kes < 50 or _amount_kes > 1000000 then
    raise exception 'Payout minimum is KSh 50';
  end if;
  select country, balance_kes into v_country, v_balance
    from public.profiles where id = v_uid for update;
  if not found then raise exception 'Profile not found'; end if;
  if upper(v_country) <> 'KE' then raise exception 'M-Pesa payouts are currently available to Kenyan accounts only'; end if;
  if v_destination ~ '^0[17][0-9]{8}$' then v_destination := '254' || substr(v_destination, 2); end if;
  if v_destination ~ '^[17][0-9]{8}$' then v_destination := '254' || v_destination; end if;
  if v_destination !~ '^254[17][0-9]{8}$' then raise exception 'Enter a valid Kenyan M-Pesa number'; end if;
  if _amount_kes > v_balance then raise exception 'Insufficient KES balance'; end if;

  update public.profiles set balance_kes = balance_kes - _amount_kes where id = v_uid;
  insert into public.payouts(user_id, method, destination, amount, currency)
    values (v_uid, 'mpesa', v_destination, _amount_kes, 'KES') returning id into v_id;
  insert into public.wallet_transactions(user_id, kind, amount, currency, reference_id, note)
    values (v_uid, 'payout', -_amount_kes, 'KES', v_id::text, 'M-Pesa payout requested');
  return v_id;
end $$;

create or replace function public.process_payout(_id uuid, _reference text, _status text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_payout public.payouts%rowtype;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Administrator access required'; end if;
  if _status not in ('paid', 'rejected') then raise exception 'Unsupported payout status'; end if;
  select * into v_payout from public.payouts where id = _id for update;
  if not found or v_payout.status <> 'pending' then raise exception 'Only pending payouts can be processed'; end if;
  if _status = 'paid' and nullif(btrim(_reference), '') is null then raise exception 'Payment reference is required'; end if;
  update public.payouts set status = _status, reference = nullif(btrim(_reference), ''), processed_at = now() where id = _id;
  if _status = 'rejected' then
    update public.profiles set balance_kes = balance_kes + v_payout.amount where id = v_payout.user_id;
    insert into public.wallet_transactions(user_id, kind, amount, currency, reference_id, note)
      values (v_payout.user_id, 'payout_refund', v_payout.amount, 'KES', _id::text, 'M-Pesa payout rejected and balance refunded');
  end if;
end $$;

revoke all on function public.request_payout(numeric, text), public.process_payout(uuid, text, text),
  public.review_task_submission(uuid, text, text) from public;
grant execute on function public.request_payout(numeric, text), public.process_payout(uuid, text, text),
  public.review_task_submission(uuid, text, text) to authenticated, service_role;

notify pgrst, 'reload schema';
