-- DVA Dashboard — pending-state columns for achievements
--
-- Adds the "pending" tri-state companion columns to students so each
-- achievement can cycle: none → pending → achieved → none.
--
-- Referenced by:
--   web/components/students/achievements-section.tsx (cycle / cycleCert)
--   web/app/(app)/reports/page.tsx                   (KPI + pie chart aggregates)

alter table public.students
  add column if not exists is_super_baker_pending     boolean not null default false,
  add column if not exists is_hall_of_fame_pending    boolean not null default false,
  add column if not exists bbr_pending                boolean not null default false,
  add column if not exists certificate_pending_manual boolean not null default false;
