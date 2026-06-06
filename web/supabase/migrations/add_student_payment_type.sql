-- Preferred payment method for a student (UPI / NEFT / Card / …).
--
-- Set on the Add Student form and used to tailor EMI reminders: the reminder
-- preview wording adapts to the method, and the value is included in the GHL
-- payload (as `payment_type`) so a GoHighLevel workflow can branch to the right
-- message template per method.
--
-- Free-text (not an enum) so the option list can grow without a schema change —
-- the UI list lives in lib/payment-types.ts.
--
-- Safe to run repeatedly: uses IF NOT EXISTS.

alter table public.students
  add column if not exists payment_type text;

comment on column public.students.payment_type is 'Preferred payment method, e.g. "UPI", "NEFT", "Card". Used to pick the EMI reminder template.';

-- Tell PostgREST (the Supabase API layer) to pick up the new column.
notify pgrst, 'reload schema';
