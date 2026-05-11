-- DVA Dashboard — Down payment + total fee tracking on students
--
-- Adds three columns so we can record the upfront down-payment a student
-- pays before the EMI schedule kicks in, plus the headline course fee.
--
-- Backwards-compatible: existing rows simply have NULL until edited.

alter table public.students
  add column if not exists total_fee         numeric(12,2),
  add column if not exists down_payment      numeric(12,2),
  add column if not exists down_payment_date date;

comment on column public.students.total_fee         is 'Total course fee in INR (informational; not used in calculations)';
comment on column public.students.down_payment      is 'Upfront amount paid before EMI begins, in INR';
comment on column public.students.down_payment_date is 'When the down payment was received';
