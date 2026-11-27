-- Add public ad and account-subscription opportunities to the gig marketplace.
-- Published tasks are already visible to every authenticated member under the
-- published_tasks_read policy. A task's slots determine how many members may
-- claim it; task_claims' (task_id, user_id) key allows each member one spot.

alter table public.tasks
  add column if not exists task_type text not null default 'general';

-- Preserve existing multi-slot listings as public ads. Existing single-slot
-- listings remain one-person general gigs.
update public.tasks
set task_type = case
  when lower(category) in ('account subscription', 'account_subscription') then 'account_subscription'
  when lower(category) = 'ad' or slots > 1 then 'ad'
  else 'general'
end;

alter table public.tasks drop constraint if exists tasks_task_type_check;
alter table public.tasks add constraint tasks_task_type_check
  check (task_type in ('general', 'ad', 'account_subscription'));

alter table public.tasks drop constraint if exists tasks_general_single_slot_check;
alter table public.tasks add constraint tasks_general_single_slot_check
  check (task_type <> 'general' or slots = 1);

notify pgrst, 'reload schema';
