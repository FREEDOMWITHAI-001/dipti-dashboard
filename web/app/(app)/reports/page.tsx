import { LineChart } from 'lucide-react';
import { KpiCard } from '@/components/ui/kpi-card';
import { supabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const sb = supabaseServer();

  const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
  const startMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  const [{ count: callCount }, { count: studentCount }, { data: reminders30 }, { data: paidThis }, { data: dueThis }] = await Promise.all([
    sb.from('call_logs').select('id', { count: 'exact', head: true }).gte('created_at', since30),
    sb.from('students').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    sb.from('reminders').select('status').gte('created_at', since30),
    sb.from('emi_schedule').select('amount').eq('status', 'paid').gte('paid_date', startMonth),
    sb.from('emi_schedule').select('amount').gte('due_date', startMonth).lt('due_date', new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString().slice(0, 10)),
  ]);

  const callsPerStudent = (studentCount ?? 0) > 0 ? ((callCount ?? 0) / (studentCount ?? 1)) : 0;

  const remList = (reminders30 ?? []) as any[];
  const remTotal = remList.length;
  const remDelivered = remList.filter((r) => r.status === 'delivered' || r.status === 'sent').length;
  const deliveryRate = remTotal > 0 ? (remDelivered / remTotal) * 100 : null;

  const paidAmt = ((paidThis ?? []) as any[]).reduce((s, r: any) => s + Number(r.amount ?? 0), 0);
  const dueAmt  = ((dueThis  ?? []) as any[]).reduce((s, r: any) => s + Number(r.amount ?? 0), 0);
  const collectionRatio = dueAmt > 0 ? (paidAmt / dueAmt) * 100 : null;

  const fmtPct = (n: number | null) => n === null ? '—' : `${n.toFixed(1)}%`;

  return (
    <div className="px-7 py-7 max-w-[1200px]">
      <h1 className="text-[24px] font-semibold tracking-tight mb-1">Reports</h1>
      <p className="text-[13.5px] text-ink-500 mb-6">Coverage, conversion, and collection at a glance.</p>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <KpiCard
          label="Calls per student / month"
          value={callsPerStudent.toFixed(1)}
          sub={`${callCount ?? 0} calls · ${studentCount ?? 0} students (last 30 d)`}
          icon="Phone"
          tone={callsPerStudent >= 4 ? 'good' : 'warn'}
        />
        <KpiCard
          label="Reminder delivery rate"
          value={fmtPct(deliveryRate)}
          sub={remTotal > 0 ? `${remDelivered}/${remTotal} (last 30 d)` : 'no reminders sent yet'}
          icon="CheckCircle2"
          tone={deliveryRate === null ? undefined : deliveryRate >= 95 ? 'good' : 'warn'}
        />
        <KpiCard
          label="Collection vs due"
          value={fmtPct(collectionRatio)}
          sub={dueAmt > 0 ? `₹${Math.round(paidAmt).toLocaleString('en-IN')} of ₹${Math.round(dueAmt).toLocaleString('en-IN')} MTD` : 'no EMIs due this month'}
          icon="TrendingUp"
          tone={collectionRatio === null ? undefined : collectionRatio >= 80 ? 'good' : 'warn'}
        />
      </div>

      <div className="bg-white border border-ink-200/70 rounded-xl p-5 h-72 grid place-items-center text-ink-400 text-[13px]">
        <div className="text-center">
          <LineChart className="w-8 h-8 mx-auto mb-2 text-ink-300" />
          Reports module — charts wire up in v1.1
        </div>
      </div>
    </div>
  );
}
