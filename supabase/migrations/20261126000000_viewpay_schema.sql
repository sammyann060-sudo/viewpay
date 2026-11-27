-- ViewPay's initial database schema. Keep balance-changing rules in the
-- SECURITY DEFINER functions added by the next migration.

create extension if not exists pgcrypto with schema extensions;

do $$
begin
  create type public.app_role as enum ('admin', 'user');
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text,
  country text not null default 'KE' check (char_length(country) = 2),
  phone text not null default '',
  phone_number text,
  phone_verified_at timestamptz,
  points integer not null default 0 check (points >= 0),
  referral_code text not null,
  referred_by uuid references public.profiles (id) on delete set null,
  referral_rewarded boolean not null default false,
  created_at timestamptz not null default now(),
  device_lock_required boolean not null default false,
  pending_device_id uuid
);

-- `CREATE TABLE IF NOT EXISTS` does not add columns to an existing profiles
-- table. Bring older project profiles up to the ViewPay shape before the
-- indexes and auth trigger below use those fields.
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists country text not null default 'KE';
alter table public.profiles add column if not exists phone text not null default '';
alter table public.profiles add column if not exists phone_number text;
alter table public.profiles add column if not exists phone_verified_at timestamptz;
alter table public.profiles add column if not exists points integer not null default 0;
alter table public.profiles add column if not exists referral_code text;
alter table public.profiles add column if not exists referred_by uuid;
alter table public.profiles add column if not exists referral_rewarded boolean not null default false;
alter table public.profiles add column if not exists device_lock_required boolean not null default false;
alter table public.profiles add column if not exists pending_device_id uuid;

update public.profiles
set referral_code = upper(substr(md5(id::text), 1, 8))
where referral_code is null or btrim(referral_code) = '';

alter table public.profiles alter column referral_code set not null;

create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username)) where username is not null;
create unique index if not exists profiles_referral_code_key
  on public.profiles (referral_code);
create unique index if not exists profiles_phone_number_key
  on public.profiles (phone_number) where phone_number is not null;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  constraint user_roles_user_role_key unique (user_id, role)
);

create table if not exists public.ads (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  advertiser text not null,
  video_url text not null,
  duration_sec integer not null check (duration_sec > 0),
  question text not null,
  options text[] not null check (cardinality(options) >= 2),
  correct_index integer not null check (correct_index >= 0 and correct_index < cardinality(options)),
  points integer not null check (points > 0),
  active boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.ad_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ad_id uuid not null references public.ads (id) on delete restrict,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  correct boolean,
  points_awarded integer not null default 0 check (points_awarded >= 0)
);

create index if not exists ad_views_user_started_idx
  on public.ad_views (user_id, started_at desc);
create index if not exists ad_views_ad_user_idx
  on public.ad_views (ad_id, user_id);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  points_delta integer not null,
  amount numeric(14, 2),
  currency text,
  reference_id text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists wallet_transactions_user_created_idx
  on public.wallet_transactions (user_id, created_at desc);

create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  method text not null check (method in ('mpesa', 'usdt')),
  destination text not null,
  points integer not null check (points > 0),
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null check (currency in ('KES', 'USDT')),
  status text not null default 'pending' check (status in ('pending', 'paid', 'rejected')),
  reference text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists payouts_user_created_idx
  on public.payouts (user_id, created_at desc);
create index if not exists payouts_status_created_idx
  on public.payouts (status, created_at);

create table if not exists public.device_accounts (
  device_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  verified_at timestamptz,
  primary key (device_id, user_id)
);

create index if not exists device_accounts_user_idx
  on public.device_accounts (user_id, last_seen_at desc);

create table if not exists public.platform_settings (
  setting_key text primary key default 'global',
  maintenance_mode boolean not null default false,
  announcement text,
  support_email text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

create table if not exists public.admin_agents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  country text not null default 'KE' check (char_length(country) = 2),
  commission_unit text not null,
  commission_rate numeric(14, 4) not null check (commission_rate > 0),
  currency text not null default 'KES' check (currency in ('KES', 'USD', 'USDT')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_commissions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.admin_agents (id) on delete restrict,
  period_start date not null,
  period_end date not null,
  units integer not null check (units > 0),
  unit_label text not null,
  rate numeric(14, 4) not null check (rate > 0),
  amount numeric(14, 2),
  currency text not null check (currency in ('KES', 'USD', 'USDT')),
  status text not null default 'pending' check (status in ('pending', 'paid')),
  reference text,
  note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  constraint agent_commissions_period_check check (period_end >= period_start)
);

create index if not exists agent_commissions_agent_period_idx
  on public.agent_commissions (agent_id, period_start desc);
create index if not exists agent_commissions_status_created_idx
  on public.agent_commissions (status, created_at desc);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_referral_code text;
  v_referrer_id uuid;
  v_country text;
  v_username text;
begin
  v_referral_code := upper(substr(md5(gen_random_uuid()::text), 1, 8));
  v_country := upper(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'country'), ''), 'KE'));
  v_username := nullif(lower(btrim(new.raw_user_meta_data ->> 'username')), '');

  select p.id
  into v_referrer_id
  from public.profiles as p
  where p.referral_code = upper(nullif(btrim(new.raw_user_meta_data ->> 'ref'), ''))
    and p.id <> new.id
  limit 1;

  insert into public.profiles (
    id, username, country, phone, phone_number, referral_code, referred_by
  ) values (
    new.id,
    v_username,
    v_country,
    coalesce(new.phone, new.email, new.id::text),
    new.phone,
    v_referral_code,
    v_referrer_id
  );

  insert into public.user_roles (user_id, role)
  values (new.id, 'user');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
