-- Feature: edit an EMI's amount before generating its payment link, and once
-- that edited EMI is actually PAID, spread the difference evenly across the
-- remaining unpaid installments so the plan TOTAL never changes.
--
-- How it works:
--   • When the coach edits an EMI in the "Get link" modal, we store the
--     pre-edit plan amount in `original_amount` and set `amount` to the new
--     value. The other EMIs are left untouched at this point.
--   • Payments complete through four different paths (Cashfree webhook, manual
--     Sync, Mark-paid modal, Collect-payment modal) — all of them UPDATE the row
--     to status='paid'. A single BEFORE UPDATE trigger therefore catches every
--     path: on the transition into 'paid', it computes
--         delta = amount - original_amount
--     and removes that delta, split evenly (whole rupees, remainder on the last
--     row), from the still-unpaid installments. Then it clears original_amount.
--
-- Safe to run repeatedly.

-- 1) Remember the plan amount the EMI had before it was edited for a link.
alter table public.emi_schedule
  add column if not exists original_amount numeric;

-- 2) Redistribution trigger function.
create or replace function public.emi_redistribute_on_paid()
returns trigger
language plpgsql
as $$
declare
  v_delta      numeric;
  v_count      int;
  v_idx        int := 0;
  v_share      numeric;
  v_left       numeric;   -- amount still to spread (carried forward row to row)
  v_remaining  record;
  v_new        numeric;
begin
  -- Only act on the transition INTO 'paid', and only for EMIs that were edited
  -- before their link was generated (original_amount holds the plan amount).
  if new.status = 'paid'
     and old.status is distinct from 'paid'
     and new.original_amount is not null then

    v_delta := coalesce(new.amount, 0) - new.original_amount;

    -- Clear the marker so re-saving the paid row can't double-apply the spread.
    new.original_amount := null;

    if v_delta <> 0 then
      -- Count the remaining unpaid installments for this student (exclude self).
      select count(*) into v_count
      from public.emi_schedule
      where student_id = new.student_id
        and id <> new.id
        and status not in ('paid', 'cancelled');

      if v_count > 0 then
        -- Spread v_delta across the remaining rows. We re-divide the amount that
        -- is STILL LEFT over the rows STILL REMAINING each step, so when a small
        -- row can't absorb its full share the shortfall is CARRIED FORWARD to
        -- later rows instead of being silently dropped at the 0 floor. This keeps
        -- the plan total exact whenever the remaining rows can collectively
        -- absorb the change (the "Get link" screen blocks edits that can't).
        v_left := v_delta;
        for v_remaining in
          select id, amount
          from public.emi_schedule
          where student_id = new.student_id
            and id <> new.id
            and status not in ('paid', 'cancelled')
          order by due_date asc, installment_no asc
        loop
          v_idx := v_idx + 1;
          if v_idx < v_count then
            v_share := round(v_left / (v_count - v_idx + 1));
          else
            v_share := v_left;   -- last remaining row takes whatever is left
          end if;

          v_new := coalesce(v_remaining.amount, 0) - v_share;
          if v_new < 0 then
            -- This row can't give back its whole share; take only what it has and
            -- carry the rest to the next row.
            v_share := coalesce(v_remaining.amount, 0);
            v_new := 0;
          end if;

          update public.emi_schedule set amount = v_new where id = v_remaining.id;
          v_left := v_left - v_share;
        end loop;
        -- If v_left <> 0 after the loop, the remaining rows genuinely couldn't
        -- absorb the whole change (an increase bigger than the remaining balance).
        -- We leave the rows floored at 0 rather than make one negative; the UI
        -- prevents this case up front.
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- 3) Fire it before every EMI row update.
drop trigger if exists trg_emi_redistribute_on_paid on public.emi_schedule;
create trigger trg_emi_redistribute_on_paid
  before update on public.emi_schedule
  for each row
  execute function public.emi_redistribute_on_paid();

-- Tell PostgREST (the Supabase API layer) to pick up the new column.
notify pgrst, 'reload schema';
