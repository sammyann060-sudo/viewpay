-- Server-owned business rules and least-privilege access for ViewPay.

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles r where r.user_id = _user_id and r.role = _role)
$$;

create or replace function public.daily_ad_limit()
returns integer language sql immutable set search_path = '' as $$ select 20 $$;

create or replace function public.my_referral_count()
returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.profiles p where p.referred_by = auth.uid()
$$;

create or replace function public.sync_verified_phone()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_phone text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select u.phone into v_phone from auth.users u where u.id = auth.uid() and u.phone_confirmed_at is not null;
  if v_phone is null then raise exception 'Verify your phone number first'; end if;
  update public.profiles set phone_number = v_phone, phone = v_phone, phone_verified_at = now() where id = auth.uid();
  return jsonb_build_object('verified', true);
end $$;

create or replace function public.register_device(_device_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_count integer; v_verified timestamptz;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select verified_at into v_verified from public.device_accounts where device_id = _device_id and user_id = v_uid;
  if found and v_verified is not null then
    update public.device_accounts set last_seen_at = now() where device_id = _device_id and user_id = v_uid;
    return jsonb_build_object('requires_verification', false);
  end if;
  select count(distinct user_id)::integer into v_count from public.device_accounts where device_id = _device_id;
  if v_count >= 2 and not exists (select 1 from public.device_accounts where device_id = _device_id and user_id = v_uid) then
    raise exception 'This device has reached its account limit';
  end if;
  insert into public.device_accounts(device_id,user_id,last_seen_at) values (_device_id,v_uid,now())
    on conflict (device_id,user_id) do update set last_seen_at = now();
  update public.profiles set pending_device_id = _device_id, device_lock_required = true where id = v_uid;
  return jsonb_build_object('requires_verification', true);
end $$;

create or replace function public.complete_device_verification(_device_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_user auth.users%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select * into v_user from auth.users where id = v_uid;
  if not found or (v_user.email_confirmed_at is null and v_user.phone_confirmed_at is null) then
    raise exception 'Verify your email or phone number first';
  end if;
  update public.device_accounts set verified_at = now(), last_seen_at = now() where device_id = _device_id and user_id = v_uid;
  if not found then raise exception 'Device registration was not found'; end if;
  update public.profiles set pending_device_id = null, device_lock_required = false where id = v_uid and pending_device_id = _device_id;
  if not found then raise exception 'This device is not awaiting verification'; end if;
end $$;

create or replace function public.start_ad_view(_ad_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_view uuid; v_count integer; v_start timestamptz;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  v_start := date_trunc('day', now() at time zone 'Africa/Nairobi') at time zone 'Africa/Nairobi';
  perform 1 from public.profiles where id = v_uid for update;
  select count(*)::integer into v_count from public.ad_views where user_id = v_uid and started_at >= v_start;
  if v_count >= public.daily_ad_limit() then raise exception 'Daily ad limit reached'; end if;
  if exists (select 1 from public.ad_views where user_id = v_uid and ad_id = _ad_id and started_at >= v_start and completed_at is not null) then
    raise exception 'This ad has already been completed today';
  end if;
  if not exists (select 1 from public.ads where id = _ad_id and active) then raise exception 'Ad is unavailable'; end if;
  insert into public.ad_views(user_id,ad_id) values (v_uid,_ad_id) returning id into v_view;
  return v_view;
end $$;

create or replace function public.complete_ad_view(_view_id uuid, _answer integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_view public.ad_views%rowtype; v_ad public.ads%rowtype; v_correct boolean; v_points integer := 0; v_referrer uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select * into v_view from public.ad_views where id = _view_id and user_id = v_uid for update;
  if not found or v_view.completed_at is not null then raise exception 'Ad view is unavailable or already completed'; end if;
  select * into v_ad from public.ads where id = v_view.ad_id and active;
  if not found then raise exception 'Ad is unavailable'; end if;
  if now() < v_view.started_at + make_interval(secs => v_ad.duration_sec) then raise exception 'Watch the full ad before answering'; end if;
  v_correct := (_answer = v_ad.correct_index);
  if v_correct then v_points := v_ad.points; end if;
  update public.ad_views set completed_at = now(), correct = v_correct, points_awarded = v_points where id = _view_id;
  if v_correct then
    update public.profiles set points = points + v_points where id = v_uid returning referred_by into v_referrer;
    insert into public.wallet_transactions(user_id,kind,points_delta,reference_id,note)
      values (v_uid,'ad_reward',v_points,_view_id::text,'Correct ad answer');
    if v_referrer is not null then
      update public.profiles set points = points + 50, referral_rewarded = true
        where id = v_referrer and not referral_rewarded;
      if found then
        insert into public.wallet_transactions(user_id,kind,points_delta,reference_id,note)
          values (v_referrer,'referral_reward',50,v_uid::text,'Referral first ad reward');
      end if;
    end if;
  end if;
  return jsonb_build_object('correct',v_correct,'points',v_points,'correct_index',v_ad.correct_index);
end $$;

create or replace function public.request_payout(_method text, _destination text, _points integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_country text; v_balance integer; v_amount numeric(14,2); v_currency text; v_id uuid; v_dest text := btrim(_destination);
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if _points is null or _points <= 0 then raise exception 'Enter a valid points amount'; end if;
  select country,points into v_country,v_balance from public.profiles where id = v_uid for update;
  if not found then raise exception 'Profile not found'; end if;
  if _method = 'mpesa' then
    if upper(v_country) <> 'KE' then raise exception 'M-Pesa payouts are only available in Kenya'; end if;
    if _points < 250 then raise exception 'M-Pesa minimum is 250 points'; end if;
    if v_dest ~ '^0[17][0-9]{8}$' then v_dest := '254' || substr(v_dest,2); end if;
    if v_dest ~ '^[17][0-9]{8}$' then v_dest := '254' || v_dest; end if;
    if v_dest !~ '^254[17][0-9]{8}$' then raise exception 'Enter a valid Kenyan M-Pesa number'; end if;
    v_currency := 'KES'; v_amount := round(_points * 0.2,2);
  elsif _method = 'usdt' then
    if _points < 650 then raise exception 'USDT minimum is 650 points'; end if;
    if char_length(v_dest) < 20 or char_length(v_dest) > 128 then raise exception 'Enter a valid USDT address'; end if;
    v_currency := 'USDT'; v_amount := round((_points * 0.2) / 130,2);
  else raise exception 'Unsupported payout method'; end if;
  if _points > v_balance then raise exception 'Insufficient points balance'; end if;
  update public.profiles set points = points - _points where id = v_uid;
  insert into public.payouts(user_id,method,destination,points,amount,currency) values (v_uid,_method,v_dest,_points,v_amount,v_currency) returning id into v_id;
  insert into public.wallet_transactions(user_id,kind,points_delta,amount,currency,reference_id,note)
    values (v_uid,'payout',-_points,v_amount,v_currency,v_id::text,'Payout requested');
  return v_id;
end $$;

create or replace function public.process_payout(_id uuid, _reference text, _status text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_payout public.payouts%rowtype;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Administrator access required'; end if;
  if _status not in ('paid','rejected') then raise exception 'Unsupported payout status'; end if;
  select * into v_payout from public.payouts where id = _id for update;
  if not found or v_payout.status <> 'pending' then raise exception 'Only pending payouts can be processed'; end if;
  if _status = 'paid' and nullif(btrim(_reference),'') is null then raise exception 'Payment reference is required'; end if;
  update public.payouts set status = _status, reference = nullif(btrim(_reference),''), processed_at = now() where id = _id;
  if _status = 'rejected' then
    update public.profiles set points = points + v_payout.points where id = v_payout.user_id;
    insert into public.wallet_transactions(user_id,kind,points_delta,amount,currency,reference_id,note)
      values (v_payout.user_id,'payout_refund',v_payout.points,v_payout.amount,v_payout.currency,_id::text,'Payout rejected and points refunded');
  end if;
end $$;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.ads enable row level security;
alter table public.ad_views enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.payouts enable row level security;
alter table public.device_accounts enable row level security;
alter table public.platform_settings enable row level security;
alter table public.admin_agents enable row level security;
alter table public.agent_commissions enable row level security;

create policy profiles_read_self on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy roles_read_self on public.user_roles for select to authenticated using (user_id = (select auth.uid()));
create policy active_ads_read on public.ads for select to authenticated using (active);
create policy ad_views_read_self on public.ad_views for select to authenticated using (user_id = (select auth.uid()));
create policy wallet_read_self on public.wallet_transactions for select to authenticated using (user_id = (select auth.uid()));
create policy payouts_read_self on public.payouts for select to authenticated using (user_id = (select auth.uid()));
create policy settings_read on public.platform_settings for select to authenticated using (setting_key = 'global');

revoke all on public.profiles, public.user_roles, public.ads, public.ad_views, public.wallet_transactions,
  public.payouts, public.device_accounts, public.platform_settings, public.admin_agents, public.agent_commissions from anon, authenticated;
grant select on public.profiles, public.user_roles, public.ad_views, public.wallet_transactions,
  public.payouts, public.platform_settings to authenticated;
grant select (id,title,advertiser,video_url,duration_sec,question,options,points,active,created_at) on public.ads to authenticated;
grant all on public.profiles, public.user_roles, public.ads, public.ad_views, public.wallet_transactions,
  public.payouts, public.device_accounts, public.platform_settings, public.admin_agents, public.agent_commissions to service_role;

revoke all on function public.has_role(uuid,public.app_role), public.daily_ad_limit(), public.my_referral_count(),
  public.sync_verified_phone(), public.register_device(uuid), public.complete_device_verification(uuid),
  public.start_ad_view(uuid), public.complete_ad_view(uuid,integer), public.request_payout(text,text,integer),
  public.process_payout(uuid,text,text) from public;
grant execute on function public.has_role(uuid,public.app_role), public.daily_ad_limit(), public.my_referral_count(),
  public.sync_verified_phone(), public.register_device(uuid), public.complete_device_verification(uuid),
  public.start_ad_view(uuid), public.complete_ad_view(uuid,integer), public.request_payout(text,text,integer),
  public.process_payout(uuid,text,text) to authenticated, service_role;

notify pgrst, 'reload schema';
