-- DVA Dashboard — Cashfree Payment Links integration
--
-- Adds:
--   • Cashfree credential columns on ghl_settings (kept server-side only)
--   • Per-EMI Cashfree link columns on emi_schedule
--   • cashfree_events audit table (link creation, webhook events, failures)
--   • Updates v_settings_status to expose Cashfree config flags
--
-- Same secret-handling caveat as 0005: rely on RLS + service-role for now.
-- For production, wrap these columns in Supabase Vault / pgsodium.

-- ============== ghl_settings: Cashfree credentials ==============
alter table public.ghl_settings
  add column if not exists cashfree_app_id         text,
  add column if not exists cashfree_secret_key     text,
  add column if not exists cashfree_env          
    text check (cashfree_env in ('sandbox','production')),
  add column if not exists cashfree_webhook_secret text;

-- ============== emi_schedule: Cashfree link metadata per installment ==============
alter table public.emi_schedule
  add column if not exists cashfree_link_id         text,
  add column if not exists cashfree_link_url        text,
  add column if not exists cashfree_link_status     text,
  add column if not exists cashfree_link_created_at timestamptz;

create index if not exists emi_cashfree_link_id on public.emi_schedule (cashfree_link_id)
  where cashfree_link_id is not null;

-- ============== cashfree_events: audit log of link API + webhook traffic ==============
create table if not exists public.cashfree_events (
  id                bigserial primary key,
  emi_id            uuid references public.emi_schedule(id) on delete set null,
  student_id        uuid references public.students(id) on delete set null,
  event_type        text not null,
  cashfree_link_id  text,
  payload           jsonb,
  error             text,
  created_at        timestamptz not null default now()
);
create index if not exists cashfree_events_emi    on public.cashfree_events (emi_id, created_at desc);
create index if not exists cashfree_events_linkid on public.cashfree_events (cashfree_link_id) where cashfree_link_id is not null;

alter table public.cashfree_events enable row level security;
-- Read: any authenticated user (admins + coaches viewing their students).
-- Writes happen via service-role from /api/cashfree/* — RLS denies client writes by default.
drop policy if exists cashfree_events_read on public.cashfree_events;
create policy cashfree_events_read on public.cashfree_events
  for select to authenticated using (true);

-- ============== refresh v_settings_status to expose Cashfree config ==============
create or replace view public.v_settings_status as
select
  id,
  location_id,
  case when ghl_pit_token         is null or ghl_pit_token         = '' then false else true end as ghl_configured,
  case when openai_api_key        is null or openai_api_key        = '' then false else true end as openai_configured,
  case when anthropic_api_key     is null or anthropic_api_key     = '' then false else true end as anthropic_configured,
  case when cashfree_app_id       is null or cashfree_app_id       = ''
        or cashfree_secret_key    is null or cashfree_secret_key    = '' then false else true end as cashfree_configured,
  right(coalesce(ghl_pit_token,         ''), 4) as ghl_last4,
  right(coalesce(openai_api_key,        ''), 4) as openai_last4,
  right(coalesce(anthropic_api_key,     ''), 4) as anthropic_last4,
  right(coalesce(cashfree_app_id,       ''), 4) as cashfree_app_id_last4,
  coalesce(cashfree_env, 'sandbox')              as cashfree_env,
  last_full_sync,
  updated_at
from public.ghl_settings;

grant select on public.v_settings_status to authenticated;