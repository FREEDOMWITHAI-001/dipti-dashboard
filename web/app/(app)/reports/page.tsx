import { supabaseServer } from '@/lib/supabase/server';
import { selectAllRows } from '@/lib/utils';
import { KpiCard } from '@/components/ui/kpi-card';
import { ReportsDateFilter } from './date-filter';
import {
  CallsPerWeekChart, CollectionRateChart, ReminderDeliveryChart, StudentFunnelChart,
  CompletionDistributionChart, PerMonthCompletionChart,
  AchievementsOverviewChart, CertificateStatusChart,
  type CallsPerWeekPoint, type CollectionRatePoint, type ReminderStatusSlice, type FunnelStage,
  type CompletionDistributionPoint, type PerMonthCompletionPoint,
  type AchievementPoint, type CertStatusSlice,
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

export default async function ReportsPage({ searchParams }: { searchParams: { preset?: string; from?: string; to?: string } }) {
  const sb = supabaseServer();
  const now = new Date();

  // Resolve the selected window from the URL (?preset= or ?from=&to=). It drives
  // the time-based metrics (calls, collection, reminders) and their charts; the
  // snapshot sections (achievements, completion, funnel) ignore it — they're
  // current-state counts with no time dimension.
  const range  = resolveRange(searchParams ?? {}, now);
  const fromIso = range.from.toISOString();
  const toIso   = range.to.toISOString();
  const dueFrom = ymd(range.from);   // emi.due_date is a DATE column → compare by calendar day
  const dueTo   = ymd(range.to);

  // All five reads are paginated (stable .order('id') + .range) so they don't
  // hit the PostgREST 1000-row cap and silently undercount the KPIs/charts.
  const [students, calls, emi, reminders, achievementStudents] = await Promise.all([
    selectAllRows((f, t) => sb.from('students').select('id, end_date, course_end_date, deleted_at').is('deleted_at', null).order('id').range(f, t)),
    selectAllRows((f, t) => sb.from('call_logs').select('created_at, student_id').gte('created_at', fromIso).lte('created_at', toIso).order('id').range(f, t)),
    selectAllRows((f, t) => sb.from('emi_schedule').select('amount, due_date, status, paid_date').gte('due_date', dueFrom).lte('due_date', dueTo).order('id').range(f, t)),
    selectAllRows((f, t) => sb.from('reminders').select('event_id, status').gte('created_at', fromIso).lte('created_at', toIso).order('id').range(f, t)),
    selectAllRows((f, t) => sb.from('students').select('id, month_1, month_2, month_3, month_4, month_5, month_6, is_super_baker_finisher, is_super_baker_pending, is_hall_of_fame, is_hall_of_fame_pending, certificate_issued, certificate_pending_manual, bbr_attended, bbr_pending, deleted_at').is('deleted_at', null).order('id').range(f, t)),
  ]);
  
  // ---------- Achievement metrics ----------
  const achievementList = (achievementStudents ?? []) as any[];
  
  const superBakerCount         = achievementList.filter(s => s.is_super_baker_finisher).length;
  const superBakerPendingCount  = achievementList.filter(s => s.is_super_baker_pending && !s.is_super_baker_finisher).length;
  const hallOfFameCount         = achievementList.filter(s => s.is_hall_of_fame).length;
  const hallOfFamePendingCount  = achievementList.filter(s => s.is_hall_of_fame_pending && !s.is_hall_of_fame).length;
  const sixMonthCount           = achievementList.filter(s => 
    s.month_1 && s.month_2 && s.month_3 && s.month_4 && s.month_5 && s.month_6
  ).length;
  const certIssuedCount         = achievementList.filter(s => s.certificate_issued).length;
  // Cert pending: either manually marked OR auto-derived (6 months done + not issued)
  const certPendingCount        = achievementList.filter(s => 
    !s.certificate_issued && (
      s.certificate_pending_manual || 
      (s.month_1 && s.month_2 && s.month_3 && s.month_4 && s.month_5 && s.month_6)
    )
  ).length;
  const bbrAttendedCount        = achievementList.filter(s => s.bbr_attended).length;
  const bbrPendingCount         = achievementList.filter(s => s.bbr_pending && !s.bbr_attended).length;
  
  // ---------- Average completion data ----------
  const totalMonthsAcrossAll = achievementList.reduce((sum, s) => 
    sum + [s.month_1, s.month_2, s.month_3, s.month_4, s.month_5, s.month_6].filter(Boolean).length, 0
  );
  const avgCompletion = achievementList.length > 0 
    ? (totalMonthsAcrossAll / (achievementList.length * 6) * 100).toFixed(1)
    : '0.0';
  
  // Distribution: how many students at each completion level (0/6, 1/6, ..., 6/6)
  const completionDistribution: { months: string; students: number }[] = [];
  for (let i = 0; i <= 6; i++) {
    const count = achievementList.filter(s => 
      [s.month_1, s.month_2, s.month_3, s.month_4, s.month_5, s.month_6].filter(Boolean).length === i
    ).length;
    completionDistribution.push({ months: `${i}/6`, students: count });
  }
  
  // Per-month completion percentage
  const perMonthCompletion = [1,2,3,4,5,6].map(m => ({
    month: `Month ${m}`,
    completed: achievementList.filter(s => s[`month_${m}`]).length,
    pct: achievementList.length > 0 
      ? Math.round(achievementList.filter(s => s[`month_${m}`]).length / achievementList.length * 100)
      : 0,
  }));

  // Achievements overview data for chart
  const achievementsOverview: AchievementPoint[] = [
    { name: 'Super Baker',     count: superBakerCount,    fill: '#f59e0b' },  // amber
    { name: 'Hall of Fame',    count: hallOfFameCount,    fill: '#a855f7' },  // purple
    { name: '6 Month Done',    count: sixMonthCount,      fill: '#10b981' },  // emerald
    { name: 'Cert Issued',     count: certIssuedCount,    fill: '#3b82f6' },  // blue
    { name: 'Cert Pending',    count: certPendingCount,   fill: '#f97316' },  // orange
    { name: 'BBR Attended',    count: bbrAttendedCount,   fill: '#6366f1' },  // indigo
  ];

  // Certificate status pie data — slices must be mutually exclusive, so
  // "Not Eligible" is the residual after Issued + Pending (covers students
  // who haven't done 6 months and have neither cert flag set).
  const totalActive = achievementList.length;
  const certNotEligible = Math.max(0, totalActive - certIssuedCount - certPendingCount);
  const certStatusData: CertStatusSlice[] = [
    { name: 'Issued',        value: certIssuedCount,    fill: '#10b981' },
    { name: 'Pending',       value: certPendingCount,   fill: '#f97316' },
    { name: 'Not Eligible',  value: certNotEligible,    fill: '#cbd5e1' },
  ].filter(s => s.value > 0);  // only show non-zero slices

  // ---------- KPI calculations ----------
  const studentCount  = students?.length ?? 0;
  // calls / reminders / emi are already constrained to the selected range by the
  // queries above, so each KPI operates on its full fetched set.
  const callsInRange = (calls ?? []);
  const callsPerStudent = studentCount > 0
    ? (callsInRange.length / studentCount).toFixed(1)
    : '0.0';

  const reminderTotal     = (reminders ?? []).length;
  const reminderDelivered = (reminders ?? []).filter((r: any) =>
    r.status === 'sent' || r.status === 'delivered'
  ).length;
  const deliveryPct = reminderTotal > 0
    ? ((reminderDelivered / reminderTotal) * 100).toFixed(1)
    : '0.0';

  const rangeEmis = (emi ?? []);
  const rangeDue  = rangeEmis.reduce((s: number, e: any) => s + Number(e.amount), 0);
  const rangePaid = rangeEmis.filter((e: any) => e.status === 'paid')
                             .reduce((s: number, e: any) => s + Number(e.amount), 0);
  const collectionPct = rangeDue > 0 ? ((rangePaid / rangeDue) * 100).toFixed(1) : '0.0';

  // ---------- Chart data ----------
  const callsPerWeek      = buildCallsPerWeek(calls ?? [], range.from, range.to);
  const collectionByMonth = buildCollectionByMonth(emi ?? [], range.from, range.to);
  const reminderPie       = buildReminderPie(reminders ?? []);
  const studentFunnel     = buildStudentFunnel(students ?? [], now);

  return (
    <div className="px-7 py-7 max-w-[1400px]">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight">Reports</h1>
          <p className="text-[13.5px] text-ink-500 mt-1">Coverage, conversion, and collection at a glance.</p>
        </div>
        <ReportsDateFilter
          currentPreset={range.preset}
          currentFrom={range.from0}
          currentTo={range.to0}
          label={range.label}
        />
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <KpiCard
          label="Calls per student"
          value={callsPerStudent}
          sub={`${callsInRange.length} calls · ${studentCount} students · ${range.label}`}
          tone={Number(callsPerStudent) >= 4 ? 'good' : 'warn'}
          icon="Phone"
        />
        <KpiCard
          label="Reminder delivery rate"
          value={`${deliveryPct}%`}
          sub={`${reminderDelivered}/${reminderTotal} · ${range.label}`}
          tone={Number(deliveryPct) >= 95 ? 'good' : 'warn'}
          icon="Send"
        />
        <KpiCard
          label="Collection vs due"
          value={`${collectionPct}%`}
          sub={`₹${Math.round(rangePaid).toLocaleString('en-IN')} of ₹${Math.round(rangeDue).toLocaleString('en-IN')} · ${range.label}`}
          tone={Number(collectionPct) >= 80 ? 'good' : 'warn'}
          icon="IndianRupee"
        />
      </div>

      {/* Diamond Achievements section */}
      <div className="mb-6">
        <h2 className="text-[15px] font-semibold text-ink-900 mb-3 flex items-center gap-2">
          🏆 Diamond Achievements
        </h2>
        <div className="grid grid-cols-6 gap-3">
          <KpiCard
            label="Super Baker"
            value={superBakerCount.toString()}
            sub={superBakerPendingCount > 0 ? `Finishers · ${superBakerPendingCount} pending` : 'Finishers'}
            tone="good"
            icon="Trophy"
          />
          <KpiCard
            label="Hall of Fame"
            value={hallOfFameCount.toString()}
            sub={hallOfFamePendingCount > 0 ? `Achievers · ${hallOfFamePendingCount} pending` : 'Achievers'}
            tone="good"
            icon="Award"
          />
          <KpiCard
            label="6 Month Challenge"
            value={sixMonthCount.toString()}
            sub="Completed"
            tone="good"
            icon="Calendar"
          />
          <KpiCard
            label="Certificates"
            value={certIssuedCount.toString()}
            sub="Issued"
            tone="good"
            icon="FileText"
          />
          <KpiCard
            label="Cert Pending"
            value={certPendingCount.toString()}
            sub="6 mo done, no cert"
            tone={certPendingCount > 0 ? 'warn' : 'good'}
            icon="Clock"
          />
          <KpiCard
            label="BBR Attended"
            value={bbrAttendedCount.toString()}
            sub={bbrPendingCount > 0 ? `Students · ${bbrPendingCount} pending` : 'Students'}
            tone="good"
            icon="GraduationCap"
          />
        </div>
      </div>
      
      {/* Completion progress section */}
      <div className="mb-6">
        <h2 className="text-[15px] font-semibold text-ink-900 mb-3 flex items-center gap-2">
          📊 Average Completion
        </h2>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <KpiCard
            label="Average Completion"
            value={`${avgCompletion}%`}
            sub={`Across ${achievementList.length} active students`}
            tone={Number(avgCompletion) >= 50 ? 'good' : 'warn'}
            icon="BarChart"
          />
          <KpiCard
            label="Active Learners"
            value={achievementList.filter(s => 
              [s.month_1, s.month_2, s.month_3, s.month_4, s.month_5, s.month_6].filter(Boolean).length > 0 &&
              [s.month_1, s.month_2, s.month_3, s.month_4, s.month_5, s.month_6].filter(Boolean).length < 6
            ).length.toString()}
            sub="Mid-program"
            tone="good"
            icon="Users"
          />
          <KpiCard
            label="Not Started"
            value={achievementList.filter(s => 
              ![s.month_1, s.month_2, s.month_3, s.month_4, s.month_5, s.month_6].some(Boolean)
            ).length.toString()}
            sub="No months marked"
            tone={achievementList.filter(s => ![s.month_1, s.month_2, s.month_3, s.month_4, s.month_5, s.month_6].some(Boolean)).length > 50 ? 'warn' : 'good'}
            icon="AlertCircle"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <ChartCard title="Completion distribution" subtitle="Students by months completed">
          <CompletionDistributionChart data={completionDistribution} />
        </ChartCard>
        <ChartCard title="Per-month completion rate" subtitle="% of active students at each milestone">
          <PerMonthCompletionChart data={perMonthCompletion} />
        </ChartCard>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <ChartCard title="Achievements overview" subtitle="Students achieving each milestone">
          <AchievementsOverviewChart data={achievementsOverview} />
        </ChartCard>
        <ChartCard title="Certificate status" subtitle="Issued vs Pending vs Not Eligible">
          <CertificateStatusChart data={certStatusData} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <ChartCard title="Calls logged per week" subtitle={range.label}>
          <CallsPerWeekChart data={callsPerWeek} />
        </ChartCard>

        <ChartCard title="Monthly collection" subtitle={`${range.label} · ₹ due vs paid`}>
          <CollectionRateChart data={collectionByMonth} />
        </ChartCard>

        <ChartCard title="Reminder status breakdown" subtitle={range.label}>
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

// ---------- Date-range resolution (drives the time-based metrics) ----------

type ResolvedRange = { from: Date; to: Date; preset: string; from0?: string; to0?: string; label: string };

// YYYY-MM-DD from local components (emi.due_date is a DATE column, so we compare
// by calendar day and avoid a UTC toISOString() shift moving the boundary).
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Turn the URL params (?preset= or ?from=&to=) into a concrete window. A custom
// from/to wins; otherwise a preset; default is the last 30 days. The returned
// preset/from0/to0 feed the filter UI so it highlights the active choice.
function resolveRange(sp: { preset?: string; from?: string; to?: string }, now: Date): ResolvedRange {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const endOfDay   = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  const fmt = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  if (sp.from && sp.to) {
    const from = startOfDay(new Date(sp.from + 'T00:00:00'));
    const to   = endOfDay(new Date(sp.to + 'T00:00:00'));
    return { from, to, preset: 'custom', from0: sp.from, to0: sp.to, label: `${fmt(from)} – ${fmt(to)}` };
  }

  const preset = sp.preset ?? '30d';
  const to = endOfDay(now);
  switch (preset) {
    case '7d':
      return { from: startOfDay(new Date(now.getTime() - 6 * 86400000)), to, preset, label: 'Last 7 days' };
    case '90d':
      return { from: startOfDay(new Date(now.getTime() - 89 * 86400000)), to, preset, label: 'Last 90 days' };
    case 'mtd':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to, preset, label: 'This month' };
    case 'last-month': {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lmTo = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0)); // last day of previous month
      return { from, to: lmTo, preset, label: 'Last month' };
    }
    case 'ytd':
      return { from: new Date(now.getFullYear(), 0, 1), to, preset, label: 'This year' };
    case '30d':
    default:
      return { from: startOfDay(new Date(now.getTime() - 29 * 86400000)), to, preset: '30d', label: 'Last 30 days' };
  }
}

function buildCallsPerWeek(callsRaw: any[], from: Date, to: Date): CallsPerWeekPoint[] {
  // Weekly buckets (Mondays) spanning the selected range. Guard caps the bar
  // count so a long range (e.g. YTD) stays readable.
  const weeks: Date[] = [];
  const monday = new Date(from);
  const day = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - day);
  monday.setHours(0, 0, 0, 0);
  let guard = 0;
  while (monday <= to && guard < 60) {
    weeks.push(new Date(monday));
    monday.setDate(monday.getDate() + 7);
    guard++;
  }
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

function buildCollectionByMonth(emiRaw: any[], from: Date, to: Date): CollectionRatePoint[] {
  // Month buckets spanning the selected range (capped for very long ranges).
  const months: Date[] = [];
  let cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  const lastMonth = new Date(to.getFullYear(), to.getMonth(), 1);
  let guard = 0;
  while (cursor <= lastMonth && guard < 36) {
    months.push(new Date(cursor));
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    guard++;
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
    // Course end lives in course_end_date for imported/edited students; fall
    // back to the legacy end_date so neither source is ignored.
    const endVal = s.course_end_date ?? s.end_date;
    if (!endVal) { active++; continue; }
    const end = new Date(endVal).getTime();
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