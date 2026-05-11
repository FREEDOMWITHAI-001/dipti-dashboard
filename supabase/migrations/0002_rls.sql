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
