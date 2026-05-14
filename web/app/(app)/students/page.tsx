import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import { KpiCard } from '@/components/ui/kpi-card';
import { StudentsTable } from '@/components/students/students-table';
import { StudentsActions } from '@/components/students/students-actions';

export const dynamic = 'force-dynamic';

type Filter = 'all' | 'active' | 'expiring' | 'expired';

// Convert a timestamp to a short relative string like "3 d ago", "today", "yesterday".
function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return 'just now';
  const days = Math.floor(ms / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

// Format a date string to "12 May" (short).
function shortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export default async function StudentsPage({ searchParams }: { searchParams: { filter?: string } }) {
  const sb = supabaseServer();
  const activeFilter = (searchParams?.filter ?? 'all') as Filter;

  // Fetch ALL students (not just latest 50). 2000 ceiling lets the entire
  // Diamond roster load. The table itself paginates client-side via
  // PAGE_SIZE in students-table.tsx, so the user still sees 10 at a time.
  const [{ data: students, count }, { count: overdueCount }, { data: dueAmount }] = await Promise.all([
    sb.from('students').select('*', { count: 'exact' }).is('deleted_at', null).order('created_at', { ascending: false }).limit(2000),
    sb.from('emi_schedule').select('id', { count: 'exact', head: true }).eq('status', 'overdue'),
    sb.from('emi_schedule').select('amount').eq('status', 'overdue'),
  ]);

  const studentIds = (students ?? []).map((s: any) => s.id);
  // Pre-format date strings server-side so the table cells stay short and
  // don't overflow into the next column.
  const lastCallByStudent: Record<string, string> = {};
  const lastPaymentByStudent: Record<string, { mode: string; date: string }> = {};

  if (studentIds.length > 0) {
    // Most recent call per student
    const { data: calls } = await sb
      .from('call_logs')
      .select('student_id, created_at')
      .in('student_id', studentIds)
      .order('created_at', { ascending: false });
    for (const c of (calls ?? []) as any[]) {
      if (!lastCallByStudent[c.student_id]) {
        lastCallByStudent[c.student_id] = relativeTime(c.created_at);
      }
    }

    // Most recent paid EMI per student (with payment mode)
    const { data: paidEmis } = await sb
      .from('emi_schedule')
      .select('student_id, paid_date, payment_mode')
      .in('student_id', studentIds)
      .eq('status', 'paid')
      .not('paid_date', 'is', null)
      .order('paid_date', { ascending: false });
    for (const e of (paidEmis ?? []) as any[]) {
      if (!lastPaymentByStudent[e.student_id] && e.payment_mode) {
        lastPaymentByStudent[e.student_id] = {
          mode: e.payment_mode,
          date: shortDate(e.paid_date),
        };
      }
    }
  }

  const total = count ?? 0;
  const now = Date.now();
  const activeCount   = students?.filter((s: any) => !s.end_date || new Date(s.end_date).getTime() > now).length ?? 0;
  const expiringCount = students?.filter((s: any) => {
    if (!s.end_date) return false;
    const days = Math.ceil((new Date(s.end_date).getTime() - now) / 86400000);
    return days >= 0 && days <= 30;
  }).length ?? 0;
  const totalOverdue = ((dueAmount ?? []) as any[]).reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);

  return (
    <div className="px-7 py-7 max-w-[1400px]">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight leading-tight">Students</h1>
          <p className="text-[13.5px] text-ink-500 mt-1">Manage active and historical Diamond students.</p>
        </div>
        <StudentsActions />
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6">
        <Link href={'/students?filter=all' as any}      className="kpi-link" data-active={activeFilter === 'all'}>
          <KpiCard label="Total students" value={String(total)} sub="all-time" icon="Users" />
        </Link>
        <Link href={'/students?filter=active' as any}   className="kpi-link" data-active={activeFilter === 'active'}>
          <KpiCard label="Active" value={String(activeCount)} sub="currently enrolled" tone="good" icon="CircleCheck" />
        </Link>
        <Link href={'/students?filter=expiring' as any} className="kpi-link" data-active={activeFilter === 'expiring'}>
          <KpiCard label="Expiring · 30 d" value={String(expiringCount)} sub="renew window" tone="warn" icon="Clock" />
        </Link>
        <Link href={'/emi?tab=overdue' as any}          className="kpi-link">
          <KpiCard label="EMI overdue" value={String(overdueCount ?? 0)} sub={'₹' + Math.round(totalOverdue).toLocaleString('en-IN') + ' due'} tone="risk" icon="TriangleAlert" />
        </Link>
      </div>

      <StudentsTable
        initialStudents={students ?? []}
        totalCount={total}
        initialFilter={activeFilter}
        lastCallByStudent={lastCallByStudent}
        lastPaymentByStudent={lastPaymentByStudent}
      />
    </div>
  );
}