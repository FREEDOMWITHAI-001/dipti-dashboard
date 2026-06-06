-- Per-payment-type GHL workflow overrides for a reminder event.
--
-- A JSON map of { "<payment_type>": "<workflow id or webhook URL>" }, e.g.
--   { "UPI": "https://services.leadconnectorhq.com/hooks/.../upi",
--     "NEFT": "https://services.leadconnectorhq.com/hooks/.../neft" }
--
-- When an EMI reminder is sent, the student's payment_type is looked up here to
-- pick the matching GHL flow/template. If there's no entry for that type (or the
-- student has no type), the event's default_workflow_id is used instead.
--
-- Safe to run repeatedly: uses IF NOT EXISTS.

alter table public.reminder_events
  add column if not exists workflow_by_payment_type jsonb;

comment on column public.reminder_events.workflow_by_payment_type is 'Map of payment_type -> GHL workflow id / webhook URL. Overrides default_workflow_id per the student''s payment method.';

-- Tell PostgREST (the Supabase API layer) to pick up the new column.
notify pgrst, 'reload schema';
