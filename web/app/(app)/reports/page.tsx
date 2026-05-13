import { supabaseServer } from '@/lib/supabase/server';
import { KpiCard } from '@/components/ui/kpi-card';
import {
  CallsPerWeekChart, CollectionRateChart, ReminderDeliveryChart, StudentFunnelChart,
  type CallsPerWeekPoint, type CollectionRatePoint, type ReminderStatusSlice, type FunnelStage,
} from '@/components/reports/charts';

export const dynamic = 'force-dynamic';

// Color palette duplicated from charts.tsx so this server component doesn't
// need to import constants from a 'use client' file (Next.js RSC restriction).
const COLORS = {
  primary: '#6366f1',
  good:    '#10b981',
  warn:    '#f59e0b',
  risk:    '#ef4444',
};

export default async function ReportsPage() {
  const sb = supabaseServer();
  const now = new Date();

  const since12wIso = new Date(now.getTime() - 12 * 7 * 86400000).toISOString();
  const since6mIso  = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();
  const since30dIso = new Date(now.getTime() - 30 * 86400000).toISOString();

  const [
    { data: students },
    { data: calls   },
    { data: emi     },
    { data: reminders },
  ] = await Promise.all([
    sb.from('students').select('id, end_date, deleted_at').is('deleted_at', null),
    sb.from('call_logs').select('created_at, student_id').gte('created_at', since12wIso),
    sb.from('emi_schedule').select('amount, due_date, status, paid_date').gte('due_date', since6mIso),
    sb.from('reminders').select('event_id, status').gte('created_at', since30dIso),
  ]);

  // ---------- KPI calculations ----------
  const studentCount  = students?.length ?? 0;
  const callsLast30   = (calls ?? []).filter((c: any) =>
    new Date(c.created_at).getTime() > now.getTime() - 30 * 86400000
  );
  const callsPerStudent = studentCount > 0
    ? (callsLast30.length / studentCount).toFixed(1)
    : '0.0';

  const reminderTotal     = (reminders ?? []).length;
  const reminderDelivered = (reminders ?? []).filter((r: any) =>
    r.status === 'sent' || r.status === 'delivered'
  ).length;
  const deliveryPct = reminderTotal > 0
    ? ((reminderDelivered / reminderTotal) * 100).toFixed(1)
    : '0.0';

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const mtdEmis = (emi ?? []).filter((e: any) => {
    const due = new Date(e.due_date);
    return due >= monthStart && due < monthEnd;
  });
  const mtdDue  = mtdEmis.reduce((s: number, e: any) => s + Number(e.amount), 0);
  const mtdPaid = mtdEmis.filter((e: any) => e.status === 'paid')
                          .reduce((s: number, e: any) => s + Number(e.amount), 0);
  const collectionPct = mtdDue > 0 ? ((mtdPaid / mtdDue) * 100).toFixed(1) : '0.0';

  // ---------- Chart data ----------
  const callsPerWeek      = buildCallsPerWeek(calls ?? [], now);
  const collectionByMonth = buildCollectionByMonth(emi ?? [], now);
  const reminderPie       = buildReminderPie(reminders ?? []);
  const studentFunnel     = buildStudentFunnel(students ?? [], now);

  return (
    <div className="px-7 py-7 max-w-[1400px]">
      <div className="mb-6">
        <h1 className="text-[24px] font-semibold tracking-tight">Reports</h1>
        <p className="text-[13.5px] text-ink-500 mt-1">Coverage, conversion, and collection at a glance.</p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <KpiCard
          label="Calls per student / month"
          value={callsPerStudent}
          sub={`${callsLast30.length} calls · ${studentCount} students (last 30 d)`}
          tone={Number(callsPerStudent) >= 4 ? 'good' : 'warn'}
          icon="Phone"
        />
        <KpiCard
          label="Reminder delivery rate"
          value={`${deliveryPct}%`}
          sub={`${reminderDelivered}/${reminderTotal} (last 30 d)`}
          tone={Number(deliveryPct) >= 95 ? 'good' : 'warn'}
          icon="Send"
        />
        <KpiCard
          label="Collection vs due"
          value={`${collectionPct}%`}
          sub={`₹${Math.round(mtdPaid).toLocaleString('en-IN')} of ₹${Math.round(mtdDue).toLocaleString('en-IN')} MTD`}
          tone={Number(collectionPct) >= 80 ? 'good' : 'warn'}
          icon="IndianRupee"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <ChartCard title="Calls logged per week" subtitle="last 12 weeks">
          <CallsPerWeekChart data={callsPerWeek} />
        </ChartCard>

        <ChartCard title="Monthly collection" subtitle="last 6 months · ₹ due vs paid">
          <CollectionRateChart data={collectionByMonth} />
        </ChartCard>

        <ChartCard title="Reminder status breakdown" subtitle="last 30 days">
          <ReminderDeliveryChart data={reminderPie} />
        </ChartCard>

        <ChartCard title="Student funnel" subtitle="current snapshot">
          <StudentFunnelChart data={studentFunnel} />
        </ChartCard>
      </div>
    </div>
  );
}

// ============================================================================
// Aggregation helpers
// ============================================================================

function lastNWeeks(n: number, anchor: Date): Date[] {
  const out: Date[] = [];
  const monday = new Date(anchor);
  const day = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - day);
  monday.setHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(monday);
    d.setDate(d.getDate() - i * 7);
    out.push(d);
  }
  return out;
}

function buildCallsPerWeek(callsRaw: any[], now: Date): CallsPerWeekPoint[] {
  const weeks = lastNWeeks(12, now);
  return weeks.map((wk) => {
    const next = new Date(wk);
    next.setDate(next.getDate() + 7);
    const inWeek = callsRaw.filter((c: any) => {
      const t = new Date(c.created_at).getTime();
      return t >= wk.getTime() && t < next.getTime();
    });
    const uniqueStudents = new Set(inWeek.map((c: any) => c.student_id)).size;
    return {
      weekLabel: wk.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      calls: inWeek.length,
      students: uniqueStudents,
    };
  });
}

function buildCollectionByMonth(emiRaw: any[], now: Date): CollectionRatePoint[] {
  const months: Date[] = [];
  for (let i = 5; i >= 0; i--) {
    months.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
  }
  return months.map((m) => {
    const next = new Date(m.getFullYear(), m.getMonth() + 1, 1);
    const inMonth = emiRaw.filter((e: any) => {
      const due = new Date(e.due_date);
      return due >= m && due < next;
    });
    const due  = inMonth.reduce((s: number, e: any) => s + Number(e.amount), 0);
    const paid = inMonth.filter((e: any) => e.status === 'paid')
                        .reduce((s: number, e: any) => s + Number(e.amount), 0);
    return {
      monthLabel: m.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
      due, paid,
      rate: due > 0 ? (paid / due) * 100 : 0,
    };
  });
}

function buildReminderPie(remindersRaw: any[]): ReminderStatusSlice[] {
  const counts = { delivered: 0, sent: 0, queued: 0, failed: 0 } as Record<string, number>;

  for (const r of remindersRaw) {
    const status = r.status as string;
    if (status === 'delivered')      counts.delivered++;
    else if (status === 'sent')      counts.sent++;
    else if (status === 'queued')    counts.queued++;
    else if (status === 'failed')    counts.failed++;
  }

  const slices: ReminderStatusSlice[] = [
    { name: 'Delivered', value: counts.delivered, color: COLORS.good    },
    { name: 'Sent',      value: counts.sent,      color: COLORS.primary },
    { name: 'Queued',    value: counts.queued,    color: COLORS.warn    },
    { name: 'Failed',    value: counts.failed,    color: COLORS.risk    },
  ];
  return slices.filter((s) => s.value > 0);
}

function buildStudentFunnel(studentsRaw: any[], now: Date): FunnelStage[] {
  let active = 0, expiring = 0, expired = 0;
  const in30d = now.getTime() + 30 * 86400000;
  for (const s of studentsRaw) {
    if (!s.end_date) { active++; continue; }
    const end = new Date(s.end_date).getTime();
    if (end < now.getTime()) expired++;
    else if (end <= in30d) expiring++;
    else active++;
  }
  return [
    { stage: 'Active',   count: active,   color: COLORS.good },
    { stage: 'Expiring', count: expiring, color: COLORS.warn },
    { stage: 'Expired',  count: expired,  color: COLORS.risk },
  ];
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-ink-200/70 rounded-xl p-5">
      <div className="mb-3">
        <div className="text-[14px] font-semibold text-ink-900">{title}</div>
        <div className="text-[11.5px] text-ink-500">{subtitle}</div>
      </div>
      {children}
    </div>
  );
}