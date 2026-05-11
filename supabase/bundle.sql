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
-- DVA Dashboard — Row-Level Security
-- All authenticated coaches have read+write on every operational table.
-- Audit log is read-only to clients (writes happen via triggers as service role).

alter table public.profiles          enable row level security;
alter table public.students          enable row level security;
alter table public.call_logs         enable row level security;
alter table public.emi_schedule      enable row level security;
alter table public.reminders         enable row level security;
alter table public.reminder_events   enable row level security;
alter table public.student_briefings enable row level security;
alter table public.audit_log         enable row level security;
alter table public.ghl_settings      enable row level security;

-- profiles: read-all, edit-self
drop policy if exists "profiles read"   on public.profiles;
drop policy if exists "profiles update self" on public.profiles;
create policy "profiles read"   on public.profiles for select using (auth.role() = 'authenticated');
create policy "profiles update self" on public.profiles for update using (id = auth.uid());

-- students
drop policy if exists "students rw" on public.students;
create policy "students rw" on public.students for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- call_logs
drop policy if exists "calls rw" on public.call_logs;
create policy "calls rw" on public.call_logs for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- emi_schedule
drop policy if exists "emi rw" on public.emi_schedule;
create policy "emi rw" on public.emi_schedule for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- reminders
drop policy if exists "reminders rw" on public.reminders;
create policy "reminders rw" on public.reminders for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- reminder_events
drop policy if exists "events read"  on public.reminder_events;
drop policy if exists "events admin" on public.reminder_events;
create policy "events read"  on public.reminder_events for select using (auth.role() = 'authenticated');
create policy "events admin" on public.reminder_events for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- briefings (read all, write via service role only)
drop policy if exists "briefings read" on public.student_briefings;
create policy "briefings read" on public.student_briefings for select using (auth.role() = 'authenticated');

-- audit_log (read all, no client writes)
drop policy if exists "audit read" on public.audit_log;
create policy "audit read" on public.audit_log for select using (auth.role() = 'authenticated');

-- ghl_settings (admin-only writes, all read)
drop policy if exists "ghl read"   on public.ghl_settings;
drop policy if exists "ghl admin"  on public.ghl_settings;
create policy "ghl read"   on public.ghl_settings for select using (auth.role() = 'authenticated');
create policy "ghl admin"  on public.ghl_settings for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
-- DVA Dashboard — triggers and helper functions

-- 1. Auto-create profile when user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public, auth
as $$
begin
  insert into public.profiles (id, display_name, initials)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)),
    upper(coalesce(new.raw_user_meta_data->>'initials', substr(new.email,1,2)))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Mark briefing stale when a new call is logged
create or replace function public.mark_briefing_stale()
returns trigger language plpgsql as $$
begin
  insert into public.student_briefings (student_id, summary_md, is_stale, source_calls_count)
  values (new.student_id, '', true, 0)
  on conflict (student_id) do update
    set is_stale = true;
  return new;
end;
$$;

drop trigger if exists call_logs_mark_briefing_stale on public.call_logs;
create trigger call_logs_mark_briefing_stale
  after insert on public.call_logs
  for each row execute procedure public.mark_briefing_stale();

-- 3. updated_at maintenance
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists students_touch on public.students;
create trigger students_touch before update on public.students
  for each row execute procedure public.touch_updated_at();

drop trigger if exists emi_touch on public.emi_schedule;
create trigger emi_touch before update on public.emi_schedule
  for each row execute procedure public.touch_updated_at();

-- 4. Audit log triggers (writes captured via service role)
create or replace function public.write_audit()
returns trigger language plpgsql security definer as $$
declare
  diff jsonb;
begin
  if (tg_op = 'INSERT') then
    insert into public.audit_log (actor_id, entity, entity_id, action, diff)
    values (auth.uid(), tg_table_name, new.id, 'create', to_jsonb(new));
    return new;
  elsif (tg_op = 'UPDATE') then
    diff = jsonb_strip_nulls(to_jsonb(new) - to_jsonb(old));
    if diff <> '{}'::jsonb then
      insert into public.audit_log (actor_id, entity, entity_id, action, diff)
      values (auth.uid(), tg_table_name, new.id, 'update', diff);
    end if;
    return new;
  elsif (tg_op = 'DELETE') then
    insert into public.audit_log (actor_id, entity, entity_id, action, diff)
    values (auth.uid(), tg_table_name, old.id, 'delete', to_jsonb(old));
    return old;
  end if;
end;
$$;

drop trigger if exists students_audit on public.students;
create trigger students_audit
  after insert or update or delete on public.students
  for each row execute procedure public.write_audit();

drop trigger if exists emi_audit on public.emi_schedule;
create trigger emi_audit
  after insert or update or delete on public.emi_schedule
  for each row execute procedure public.write_audit();

-- 5. Auto-update emi status as dates roll
create or replace function public.refresh_emi_statuses()
returns void language sql as $$
  update public.emi_schedule
     set status = case
       when status = 'paid' then 'paid'
       when due_date < current_date then 'overdue'
       when due_date <= current_date + interval '7 days' then 'due_soon'
       else 'upcoming'
     end
   where status not in ('paid','cancelled');
$$;
-- DVA Dashboard — seed data for local dev
-- Insert a handful of students + EMI rows so the UI has something to render
-- before the GHL import / Excel migration runs.

-- Reminder events catalog (always seeded)
insert into public.reminder_events (id, name, recipient_type, schedule, enabled) values
  ('emi.reminder_due',     'EMI reminder (2 days before due)', 'student', 'Daily 09:00', true),
  ('emi.overdue',          'EMI overdue follow-up',            'student', 'Daily 10:00', true),
  ('emi.batch_overdue',    'Admin overdue digest',             'admin',   'Daily 09:30', true),
  ('course.month_pending', 'Monthly progress nudge',           'student', 'Last day of month', true),
  ('course.expiring_soon', 'Course expiring (14 days)',        'student', 'Daily 09:00', true),
  ('course.expiry_digest', 'Weekly expiry digest',             'admin',   'Mon 09:00',   true),
  ('student.no_call_30d',  'Coach: silent students',           'coach',   'Daily 09:00', true),
  ('call.followup_due',    'Coach: follow-up due today',       'coach',   'Daily 09:00', true),
  ('student.assigned',     'Coach: new student assigned',      'coach',   'On event',    true),
  ('reminder.failed',      'Admin: reminder failure',          'admin',   'On event',    false)
on conflict (id) do nothing;

-- Sample students (only inserted if students table is empty)
do $$
declare student_count int;
begin
  select count(*) into student_count from public.students;
  if student_count = 0 then
    insert into public.students (email, first_name, last_name, mobile, membership, tags, start_date, end_date, background, upgrade_flag, month_1, month_2)
    values
      ('priya.sharma@example.com',  'Priya',  'Sharma',  '+91 90032 12289', 'Diamond',    array['SH'],     '2025-07-31', '2026-07-31', 'Small-town baker building order volume. Decorated cakes, mostly weddings.', true,  true, true),
      ('rohan.iyer@example.com',    'Rohan',  'Iyer',    '+91 70917 40716', 'Diamond',    array['BBR2'],   '2025-06-14', '2026-06-14', 'Pastry chef transitioning from job to home brand.',                       false, true, true),
      ('meera.kapoor@example.com',  'Meera',  'Kapoor',  '+91 78552 97964', 'Ex-Diamond', array['SBF'],    '2024-04-30', '2026-04-30', 'Six-month extension granted in Jan after personal challenges.',           true,  true, true),
      ('anjali.roy@example.com',    'Anjali', 'Roy',     '+91 88123 55104', 'Diamond',    array[]::text[], '2025-09-02', '2026-09-02', 'Recent enrolment, hasn''t responded to onboarding outreach yet.',         false, true, false),
      ('kiran.reddy@example.com',   'Kiran',  'Reddy',   '+91 99812 00342', 'Diamond',    array['bfs'],    '2026-03-11', '2027-03-11', 'Premium customer, expanding to commercial kitchen.',                      false, true, false),
      ('tanvi.mehta@example.com',   'Tanvi',  'Mehta',   '+91 78001 11823', 'Diamond',    array['SH','SBF'],'2025-08-01','2026-08-01','Top of cohort. Mentoring others.',                                         false, true, true),
      ('nikhil.patel@example.com',  'Nikhil', 'Patel',   '+91 90909 12345', 'Diamond',    array['BBR2'],   '2025-09-20', '2026-09-20', 'Engineer side-hustling into baking. Methodical, asks great questions.',   true,  true, true),
      ('ritika.bose@example.com',   'Ritika', 'Bose',    '+91 89019 88231', 'Ex-Diamond', array[]::text[], '2024-03-15', '2026-03-15', 'Graduated. Considering renewal for advanced track.',                      true,  true, true);
  end if;
end $$;

-- Sample EMI rows
insert into public.emi_schedule (student_id, installment_no, installments_total, amount, due_date, reminder_date, status, payment_link)
select s.id, 5, 9, 26173::numeric, '2026-05-13'::date, '2026-05-11'::date, 'due_soon'::text,  'https://baking.diptivartakacademy.com/pay/priya' from public.students s where s.email = 'priya.sharma@example.com'
union all
select s.id, 6, 9, 23333, '2026-05-14', '2026-05-12', 'due_soon',  'https://baking.diptivartakacademy.com/pay/rohan' from public.students s where s.email = 'rohan.iyer@example.com'
union all
select s.id, 3, 9, 22777, '2026-05-10', '2026-05-08', 'due_soon',  'https://baking.diptivartakacademy.com/pay/meera' from public.students s where s.email = 'meera.kapoor@example.com'
union all
select s.id, 7, 9, 26173, '2026-05-08', '2026-05-06', 'overdue',   'https://baking.diptivartakacademy.com/pay/anjali' from public.students s where s.email = 'anjali.roy@example.com'
union all
select s.id, 2, 9, 24500, '2026-05-18', '2026-05-16', 'upcoming',  'https://baking.diptivartakacademy.com/pay/kiran'  from public.students s where s.email = 'kiran.reddy@example.com'
on conflict do nothing;
