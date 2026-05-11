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
