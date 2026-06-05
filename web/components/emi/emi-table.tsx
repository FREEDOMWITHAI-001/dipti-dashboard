'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send, CheckCircle2, Zap } from 'lucide-react';
import { StudentAvatar } from '@/components/ui/avatar';
import { StatusPill } from '@/components/ui/status-pill';
import { fmtINR, fmtDate, cn } from '@/lib/utils';
import { ReminderModal } from '@/components/reminders/reminder-modal';
import { MarkPaidModal } from '@/components/students/mark-paid-modal';

type Row = {
  id: string;
  student_id: string;
  installment_no: number;
  installments_total: number;
  amount: number;
  due_date: string;
  status: 'upcoming' | 'due_soon' | 'overdue' | 'paid' | 'cancelled';
  paid_date?: string | null;
  payment_mode?: string | null;
  students: { id: string; first_name: string | null; last_name: string | null; email: string; mobile: string | null };
};

type TabKey = 'due' | 'overdue' | 'upcoming' | 'paid';

// "Due this week" = flagged due_soon, OR an unpaid installment due in the next 7
// days (status may still be 'upcoming' if the nightly cron hasn't flipped it).
// Mirrors the card rule in app/(app)/emi/page.tsx so the list and the KPI agree.
const isDueThisWeek = (r: Row) =>
  r.status === 'due_soon' ||
  (r.status !== 'paid' && r.status !== 'cancelled' && !!r.due_date &&
    new Date(r.due_date) <= new Date(Date.now() + 7 * 86400000) &&
    new Date(r.due_date) >= new Date());

const TABS: Array<{ key: TabKey; label: string; filter: (r: Row) => boolean }> = [
  { key: 'due',     label: 'Due this week', filter: isDueThisWeek },
  { key: 'overdue', label: 'Overdue',       filter: r => r.status === 'overdue' },
  // Exclude due-this-week rows so they aren't listed under both tabs.
  { key: 'upcoming',label: 'Upcoming',      filter: r => r.status === 'upcoming' && !isDueThisWeek(r) },
  { key: 'paid',    label: 'Paid',          filter: r => r.status === 'paid' },
];

export function EmiTable({ rows, initialTab = 'due' }: { rows: Row[]; initialTab?: TabKey }) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [reminder, setReminder] = useState<{ studentId: string; emiId: string } | null>(null);
  const [payRow, setPayRow] = useState<Row | null>(null);

  useEffect(() => { setTab(initialTab); }, [initialTab]);

  const filtered = rows.filter(TABS.find(t => t.key === tab)!.filter);

  function switchTab(k: TabKey) {
    setTab(k);
    router.push(`/emi?tab=${k}` as any, { scroll: false });
  }

  return (
    <div className="bg-white border border-ink-200/70 rounded-xl">
      <div className="px-5 py-2 border-b border-ink-100 flex gap-1 items-center">
        {TABS.map((t) => (
          <button
            key={t.key} onClick={() => switchTab(t.key)}
            className={cn(
              'px-3 h-9 text-[12.5px] font-medium rounded-md',
              tab === t.key ? 'bg-ink-100 text-ink-900' : 'text-ink-500 hover:bg-ink-50'
            )}
          >{t.label}</button>
        ))}
        <div className="ml-auto flex items-center gap-2 text-[11.5px] text-ink-500">
          <Zap className="w-3.5 h-3.5" /> Auto-scheduler ON · next run 09:00 tomorrow
        </div>
      </div>

      <div className="grid grid-cols-[1.4fr_0.6fr_0.8fr_0.8fr_0.7fr_180px] gap-4 px-6 py-2.5 border-b border-ink-100 text-[10.5px] uppercase tracking-wider text-ink-500 font-semibold">
        <div>Student</div><div>Installment</div><div>Amount</div><div>Due / Paid</div><div>Status</div><div className="text-right">Action</div>
      </div>

      {filtered.map((r) => (
        <div key={r.id} className="grid grid-cols-[1.4fr_0.6fr_0.8fr_0.8fr_0.7fr_180px] gap-4 px-6 py-3.5 items-center border-b border-ink-100 last:border-0 text-[13px]">
          <div className="flex items-center gap-2.5 min-w-0">
            <StudentAvatar first={r.students.first_name} last={r.students.last_name} size={30} />
            <div className="min-w-0">
              <div className="font-medium truncate">{r.students.first_name} {r.students.last_name}</div>
              <div className="text-[11.5px] text-ink-500 truncate">{r.students.email}</div>
            </div>
          </div>
          <div className="font-mono text-[12px] text-ink-700">{r.installment_no}/{r.installments_total}</div>
          <div className="font-medium">{fmtINR(Number(r.amount))}</div>
          <div className="text-ink-700">
            <div>{fmtDate(r.due_date)}</div>
            {r.status === 'paid' && r.paid_date && (
              <div className="text-[10.5px] text-emerald-700">
                paid {fmtDate(r.paid_date)}{r.payment_mode ? ` · ${r.payment_mode}` : ''}
              </div>
            )}
          </div>
          <div><StatusPill status={r.status} /></div>
          <div className="flex items-center justify-end gap-1">
            {r.status === 'paid' ? (
              <span className="text-[11.5px] text-ink-400">—</span>
            ) : (
              <>
                <button
                  onClick={() => setReminder({ studentId: r.student_id, emiId: r.id })}
                  className="h-8 px-2.5 rounded-md border border-ink-200 hover:bg-ink-50 text-[11.5px] font-medium flex items-center gap-1.5"
                  title="Send reminder"
                >
                  <Send className="w-3.5 h-3.5" /> Send
                </button>
                <button
                  onClick={() => setPayRow(r)}
                  className="h-8 px-2.5 rounded-md border border-emerald-200 bg-emerald-50/50 text-emerald-700 hover:bg-emerald-50 text-[11.5px] font-medium flex items-center gap-1.5"
                  title="Mark as paid"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Paid
                </button>
              </>
            )}
          </div>
        </div>
      ))}
      {filtered.length === 0 && <div className="px-6 py-12 text-center text-[13px] text-ink-500">Nothing here.</div>}

      {reminder && (
        <ReminderModal open onClose={() => setReminder(null)} studentId={reminder.studentId} emiId={reminder.emiId} />
      )}
      {payRow && (
        <MarkPaidModal
          open={!!payRow}
          onClose={() => setPayRow(null)}
          onSaved={() => router.refresh()}
          emiId={payRow.id}
          amount={Number(payRow.amount)}
          installmentLabel={`${payRow.installment_no}/${payRow.installments_total}`}
        />
      )}
    </div>
  );
}