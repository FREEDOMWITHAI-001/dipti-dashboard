-- The EMI Tracker import records a one-shot "Full Payment" on the students
-- table via full_payment_amount / full_payment_date (see achievementFields in
-- app/api/students/import-emi-tracker/route.ts and the Profile tab display).
-- These columns existed on the live DB but were never captured in a migration,
-- so a fresh database would reject the import. Add them idempotently.
--
-- Down payment uses the existing down_payment / down_payment_date columns from
-- migration 0006 — the import code was fixed to write those correct names.

alter table public.students
  add column if not exists full_payment_amount numeric(12,2),
  add column if not exists full_payment_date   date;

comment on column public.students.full_payment_amount is 'One-shot full payment amount, in INR';
comment on column public.students.full_payment_date   is 'When the full payment was received';

-- Tell PostgREST (the Supabase API layer) to pick up the new columns.
notify pgrst, 'reload schema';
