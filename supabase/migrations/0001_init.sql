-- DVA Dashboard — initial schema
-- Run order: 0001_init.sql → 0002_rls.sql → 0003_triggers.sql → 0004_seed.sql

create extension if not exists "pgcrypto";

-- ============== profiles (mirrors auth.users) ==============
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null,
  initials      text not null,
  role          text not null default 'coach' check (role in ('coach','admin')),
  avatar_color  text,
  created_at    timestamptz not null default now()
);

-- ============== students ==============
create table if not exists public.students (
  id              uuid primary key default gen_random_uuid(),
  ghl_contact_id  text unique,
  email           text not null,
  first_name      text,
  last_name       text,
  mobile          text,
  membership      text,
  tags            text[] not null default '{}',
  start_date      date,
  end_date        date,
  background      text,
  upgrade_flag    boolean not null default false,
  month_1 boolean not null default false,
  month_2 boolean not null default false,
  month_3 boolean not null default false,
  month_4 boolean not null default false,
  month_5 boolean not null default false,
  month_6 boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles(id),
  deleted_at      timestamptz
);

create unique index if not exists students_email_uniq on public.students (lower(email)) where deleted_at is null;
create index if not exists students_tags_gin on public.students using gin (tags);
create index if not exists students_end_date on public.students (end_date);
create index if not exists students_membership on public.students (membership);

-- ============== call_logs (timeline of calls) ==============
create table if not exists public.call_logs (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references public.students(id) on delete cascade,
  coach_id        uuid not null references public.profiles(id),
  comment         text not null,
  outcome         text check (outcome in ('connected','no_answer','rescheduled','wrong_number')),
  next_action     text,
  next_action_due date,
  voice_transcript boolean not null default false,
  voice_audio_path text,
  created_at      timestamptz not null default now()
);
create index if not exists call_logs_student_created on public.call_logs (student_id, created_at desc);
create index if not exists call_logs_followup on public.call_logs (next_action_due) where next_action_due is not null;

-- ============== emi_schedule ==============
create table if not exists public.emi_schedule (
  id                  uuid primary key default gen_random_uuid(),
  student_id          uuid not null references public.students(id) on delete cascade,
  installment_no      int not null check (installment_no > 0),
  installments_total  int not null check (installments_total > 0),
  amount              numeric(12,2) not null,
  due_date            date not null,
  reminder_date       date not null,
  status              text not null default 'upcoming' check (status in ('upcoming','due_soon','overdue','paid','cancelled')),
  paid_date           date,
  payment_link        text,
  payment_mode        text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (student_id, installment_no)
);
create index if not exists emi_due_status on public.emi_schedule (due_date, status);
create index if not exists emi_reminder_status on public.emi_schedule (reminder_date, status);

-- ============== reminders (dispatch log) ==============
create table if not exists public.reminders (
  id                uuid primary key default gen_random_uuid(),
  event_id          text not null,
  emi_id            uuid references public.emi_schedule(id),
  student_id        uuid references public.students(id),
  recipient_profile uuid references public.profiles(id),
  ghl_workflow_id   text,
  ghl_contact_id    text,
  channel           text check (channel in ('whatsapp','sms','email')),
  payload           jsonb,
  scheduled_at      timestamptz not null default now(),
  fired_at          timestamptz,
  status            text not null default 'queued' check (status in ('queued','sent','delivered','failed','cancelled')),
  triggered_by      uuid references public.profiles(id),
  error             text,
  created_at        timestamptz not null default now()
);
create index if not exists reminders_scheduled_status on public.reminders (scheduled_at, status);
create index if not exists reminders_student on public.reminders (student_id, created_at desc);

-- ============== reminder_events (config catalog) ==============
create table if not exists public.reminder_events (
  id                  text primary key,
  name                text not null,
  recipient_type      text not null check (recipient_type in ('student','coach','admin')),
  default_workflow_id text,
  schedule            text not null,
  enabled             boolean not null default true,
  updated_at          timestamptz not null default now()
);

-- ============== student_briefings (AI cache) ==============
create table if not exists public.student_briefings (
  student_id          uuid primary key references public.students(id) on delete cascade,
  summary_md          text not null,
  generated_at        timestamptz not null default now(),
  source_calls_count  int not null default 0,
  source_max_call_at  timestamptz,
  is_stale            boolean not null default false,
  model               text,
  tokens_in           int,
  tokens_out          int
);

-- ============== audit_log ==============
create table if not exists public.audit_log (
  id        bigserial primary key,
  actor_id  uuid references public.profiles(id),
  entity    text not null,
  entity_id uuid not null,
  action    text not null check (action in ('create','update','delete')),
  diff      jsonb,
  at        timestamptz not null default now()
);
create index if not exists audit_log_entity on public.audit_log (entity, entity_id, at desc);

-- ============== ghl_settings (one-row config) ==============
create table if not exists public.ghl_settings (
  id              int primary key default 1 check (id = 1),
  location_id     text,
  default_workflows jsonb not null default '{}',
  last_full_sync  timestamptz,
  updated_at      timestamptz not null default now()
);
insert into public.ghl_settings (id) values (1) on conflict do nothing;

-- ============== convenience views ==============
create or replace view public.v_emi_due_today as
  select e.*, s.first_name, s.last_name, s.email, s.mobile, s.ghl_contact_id
  from public.emi_schedule e
  join public.students s on s.id = e.student_id
  where e.reminder_date <= current_date
    and e.status in ('upcoming','due_soon')
    and s.deleted_at is null;

create or replace view public.v_emi_overdue as
  select e.*, s.first_name, s.last_name, s.email, s.mobile, s.ghl_contact_id
  from public.emi_schedule e
  join public.students s on s.id = e.student_id
  where e.due_date < current_date
    and e.status in ('upcoming','due_soon','overdue')
    and s.deleted_at is null;

create or replace view public.v_students_silent_30d as
  select s.id, s.first_name, s.last_name, s.email, s.mobile, s.ghl_contact_id,
         coalesce(max(c.created_at), s.created_at) as last_touch
  from public.students s
  left join public.call_logs c on c.student_id = s.id
  where s.deleted_at is null
  group by s.id
  having coalesce(max(c.created_at), s.created_at) < now() - interval '30 days';
