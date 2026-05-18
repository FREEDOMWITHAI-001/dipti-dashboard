import { supabaseServer } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/check-permission';
import { QueueCard } from '@/components/calls/queue-card';

export const dynamic = 'force-dynamic';

export default async function CallsPage() {
  await requirePermission('calls');
  const sb = supabaseServer();

  // Direct query — bypasses v_students_silent_30d view to be sure
  // Find students who have NO call_logs in the last 30 days.
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  // 1. Get all active (non-deleted) students
  const { data: students } = await sb
    .from('students')
    .select('id, first_name, last_name, email, mobile')
    .is('deleted_at', null);

  if (!students || students.length === 0) {
    return renderEmpty();
  }

  // 2. Get all recent calls (within last 30 days) and build a set of student IDs
  const { data: recentCalls } = await sb
    .from('call_logs')
    .select('student_id')
    .gte('created_at', thirtyDaysAgo);

  const studentsWithRecentCall = new Set((recentCalls ?? []).map((c: any) => c.student_id));

  // 3. Silent = student NOT in recent calls set
  const silentStudents = students.filter((s: any) => !studentsWithRecentCall.has(s.id));

  return (
    <div className="px-7 py-7 max-w-[1200px]">
      <div className="mb-6">
        <h1 className="text-[24px] font-semibold tracking-tight">Call Queue</h1>
        <p className="text-[13.5px] text-ink-500 mt-1">
          Students who haven&apos;t been called in 30+ days. {silentStudents.length} need attention.
        </p>
      </div>

      {silentStudents.length === 0 ? (
        <div className="bg-white border border-ink-200/70 rounded-xl p-12 text-center">
          <div className="text-3xl mb-2">🎉</div>
          <div className="text-[14.5px] font-medium text-ink-800 mb-1">Everyone has been called recently</div>
          <div className="text-[12.5px] text-ink-500">No students have gone 30+ days without a call.</div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {silentStudents.map((s: any) => (
            <QueueCard key={s.id} row={s} />
          ))}
        </div>
      )}
    </div>
  );
}

function renderEmpty() {
  return (
    <div className="px-7 py-7 max-w-[1200px]">
      <div className="mb-6">
        <h1 className="text-[24px] font-semibold tracking-tight">Call Queue</h1>
        <p className="text-[13.5px] text-ink-500 mt-1">Students who haven&apos;t been called in 30+ days.</p>
      </div>
      <div className="bg-white border border-ink-200/70 rounded-xl p-12 text-center text-[13px] text-ink-500">
        No students in the system yet.
      </div>
    </div>
  );
}