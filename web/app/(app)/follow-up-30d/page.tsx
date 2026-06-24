import { supabaseServer } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/check-permission';
import { selectAllRows } from '@/lib/utils';
import { FollowUp30List } from '@/components/calls/followup30-list';

export const dynamic = 'force-dynamic';

export default async function FollowUp30dPage() {
  await requirePermission('follow-up-30d');
  const sb = supabaseServer();

  // Load the whole active roster plus each student's last-call timestamp; the
  // list computes the 30-day follow-up date (last contact + 30d, recurring) and
  // filters by date range + text search client-side. selectAllRows pages past
  // the ~1000-row request cap.
  const [students, aggregates] = await Promise.all([
    selectAllRows((f, t) =>
      sb.from('students')
        .select('id, first_name, last_name, email, mobile, created_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(f, t)
    ),
    // last_call_at = MAX(call_logs.created_at) per student. A follow-up recurs
    // 30 days after the most recent call; students never called fall back to
    // created_at + 30 (their original join-based date) in the list.
    selectAllRows((f, t) =>
      sb.from('v_student_list_aggregates' as any)
        .select('student_id, last_call_at')
        .order('student_id', { ascending: true })
        .range(f, t)
    ),
  ]);

  const lastCallByStudent = new Map<string, string>();
  for (const a of (aggregates ?? []) as any[]) {
    if (a.last_call_at) lastCallByStudent.set(a.student_id, a.last_call_at);
  }

  const rows = (students ?? []).map((s: any) => ({
    ...s,
    last_call_at: lastCallByStudent.get(s.id) ?? null,
  }));

  return <FollowUp30List rows={rows} />;
}
