-- Replace rewarded ad consumption with administrator-defined, evidence-reviewed work.
-- Existing ad and wallet rows remain intact; the application no longer offers ad tasks.

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 5 and 120),
  category text not null default 'General' check (char_length(btrim(category)) between 2 and 48),
  description text not null check (char_length(btrim(description)) between 10 and 600),
  reward_kes integer not null check (reward_kes between 1 and 100000),
  slots integer not null check (slots between 1 and 10000),
  claimed_count integer not null default 0 check (claimed_count >= 0 and claimed_count <= slots),
  status text not null default 'published' check (status in ('published', 'paused', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_status_created_idx on public.tasks(status, created_at desc);

create table public.task_private_instructions (
  task_id uuid primary key references public.tasks(id) on delete cascade,
  instructions text not null check (char_length(btrim(instructions)) between 10 and 10000),
  proof_prompt text not null check (char_length(btrim(proof_prompt)) between 5 and 500)
);

create table public.task_claims (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'claimed' check (status in ('claimed', 'submitted', 'approved', 'rejected')),
  report text,
  evidence_url text,
  admin_note text,
  claimed_at timestamptz not null default now(),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  unique (task_id, user_id),
  check (report is null or char_length(report) <= 5000),
  check (evidence_url is null or char_length(evidence_url) <= 2048),
  check (admin_note is null or char_length(admin_note) <= 2000)
);

create index task_claims_user_status_idx on public.task_claims(user_id, status, claimed_at desc);
create index task_claims_task_status_idx on public.task_claims(task_id, status, submitted_at);

alter table public.tasks enable row level security;
alter table public.task_private_instructions enable row level security;
alter table public.task_claims enable row level security;

create policy published_tasks_read on public.tasks for select to authenticated using (
  status = 'published' or exists (
    select 1 from public.task_claims c
    where c.task_id = tasks.id and c.user_id = (select auth.uid())
  )
);
create policy claimed_task_instructions_read on public.task_private_instructions for select to authenticated
using (exists (
  select 1 from public.task_claims c
  where c.task_id = task_private_instructions.task_id
    and c.user_id = (select auth.uid())
    and c.status in ('claimed', 'submitted', 'approved', 'rejected')
));
create policy own_task_claims_read on public.task_claims for select to authenticated
using (user_id = (select auth.uid()));

revoke all on public.tasks, public.task_private_instructions, public.task_claims from anon, authenticated;
grant select on public.tasks, public.task_private_instructions, public.task_claims to authenticated;
grant all on public.tasks, public.task_private_instructions, public.task_claims to service_role;

create or replace function public.claim_task(_task_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_task public.tasks%rowtype;
  v_claim_id uuid;
  v_old_status text;
begin
  if v_uid is null then raise exception 'Sign in to claim a task'; end if;
  select * into v_task from public.tasks where id = _task_id for update;
  if not found or v_task.status <> 'published' then raise exception 'This task is not available'; end if;

  select id, status into v_claim_id, v_old_status from public.task_claims
    where task_id = _task_id and user_id = v_uid for update;
  if found and v_old_status <> 'rejected' then raise exception 'You already have a claim for this task'; end if;
  if v_task.claimed_count >= v_task.slots then raise exception 'All task slots have been claimed'; end if;

  if v_claim_id is null then
    insert into public.task_claims(task_id, user_id) values (_task_id, v_uid) returning id into v_claim_id;
  else
    update public.task_claims set status = 'claimed', report = null, evidence_url = null,
      admin_note = null, claimed_at = now(), submitted_at = null, reviewed_at = null
      where id = v_claim_id;
  end if;
  update public.tasks set claimed_count = claimed_count + 1, updated_at = now() where id = _task_id;
  return v_claim_id;
end $$;

create or replace function public.submit_task(_claim_id uuid, _report text, _evidence_url text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_claim public.task_claims%rowtype; v_has_evidence boolean;
begin
  if v_uid is null then raise exception 'Sign in to submit your work'; end if;
  if char_length(btrim(coalesce(_report, ''))) < 10 or char_length(_report) > 5000 then
    raise exception 'Add a work report between 10 and 5000 characters';
  end if;
  if nullif(btrim(coalesce(_evidence_url, '')), '') is not null
    and (char_length(_evidence_url) > 2048 or btrim(_evidence_url) !~* '^https?://') then
    raise exception 'Evidence link must be a valid http or https URL';
  end if;

  select c.* into v_claim from public.task_claims c where c.id = _claim_id and c.user_id = v_uid for update;
  if not found or v_claim.status <> 'claimed' then raise exception 'This task is not awaiting a submission'; end if;
  select nullif(btrim(i.proof_prompt), '') is not null into v_has_evidence
    from public.task_private_instructions i where i.task_id = v_claim.task_id;
  if not found then raise exception 'Task instructions are unavailable'; end if;
  if v_has_evidence and nullif(btrim(coalesce(_evidence_url, '')), '') is null then
    raise exception 'Add the evidence requested by the task owner';
  end if;
  update public.task_claims set status = 'submitted', report = btrim(_report),
    evidence_url = nullif(btrim(_evidence_url), ''), submitted_at = now() where id = _claim_id;
end $$;

create or replace function public.review_task_submission(_claim_id uuid, _decision text, _admin_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_claim public.task_claims%rowtype; v_task public.tasks%rowtype; v_points integer; v_referrer uuid;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Administrator access is required'; end if;
  if _decision not in ('approved', 'rejected') then raise exception 'Choose approve or reject'; end if;
  if char_length(coalesce(_admin_note, '')) > 2000 then raise exception 'Review note is too long'; end if;
  select * into v_claim from public.task_claims where id = _claim_id for update;
  if not found or v_claim.status <> 'submitted' then raise exception 'This submission has already been reviewed'; end if;
  select * into v_task from public.tasks where id = v_claim.task_id for update;

  update public.task_claims set status = _decision, admin_note = nullif(btrim(_admin_note), ''), reviewed_at = now()
    where id = _claim_id;
  if _decision = 'rejected' then
    update public.tasks set claimed_count = greatest(0, claimed_count - 1), updated_at = now() where id = v_task.id;
    return;
  end if;

  v_points := v_task.reward_kes * 5;
  update public.profiles set points = points + v_points where id = v_claim.user_id returning referred_by into v_referrer;
  insert into public.wallet_transactions(user_id, kind, points_delta, amount, currency, reference_id, note)
    values (v_claim.user_id, 'task_reward', v_points, v_task.reward_kes, 'KES', v_claim.id::text, v_task.title);
  -- Preserve the existing one-time referral reward, now triggered by the first approved task.
  if v_referrer is not null then
    update public.profiles set points = points + 50, referral_rewarded = true
      where id = v_referrer and not referral_rewarded;
    if found then
      insert into public.wallet_transactions(user_id, kind, points_delta, reference_id, note)
        values (v_referrer, 'referral_reward', 50, v_claim.user_id::text, 'Referral first approved task');
    end if;
  end if;
end $$;

revoke all on function public.claim_task(uuid), public.submit_task(uuid, text, text),
  public.review_task_submission(uuid, text, text) from public;
grant execute on function public.claim_task(uuid), public.submit_task(uuid, text, text) to authenticated;
grant execute on function public.review_task_submission(uuid, text, text) to authenticated, service_role;

notify pgrst, 'reload schema';
