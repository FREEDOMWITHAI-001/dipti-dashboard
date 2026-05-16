'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { StudentAvatar } from '@/components/ui/avatar';
import { fmtDate } from '@/lib/utils';
import { Phone, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type FollowUp = {
  id: string;
  student_id: string;
  comment: string;
  outcome: string | null;
  next_action: string;
  next_action_due: string;
  created_at: string;
  coach_initials: string | null;
  coach_name: string | null;
  student_first: string | null;
  student_last: string | null;
  student_email: string;
  student_mobile: string | null;
};

type Tab = 'all' | 'overdue' | 'today';

export function FollowupsClient({ initialItems }: { initialItems: FollowUp[] }) {
  const [tab, setTab] = useState<Tab>('all');
  const today = new Date().toISOString().slice(0, 10);
  const todayMs = Date.now();

  const overdue   = useMemo(() => initialItems.filter((f) => f.next_action_due < today), [initialItems, today]);
  const dueToday  = useMemo(() => initialItems.filter((f) => f.next_action_due === today), [initialItems, today]);

  const filtered = tab === 'all' ? [...overdue, ...dueToday]
                 : tab === 'overdue' ? overdue
                 : dueToday;

  return (
    <>
      {/* FILTER TABS */}
      <div className="bg-white border border-ink-200/70 rounded-xl mb-5 p-1.5 flex items-center gap-1 w-fit">
        <TabButton active={tab === 'all'}     onClick={() => setTab('all')}     label="All"      count={overdue.length + dueToday.length} />
        <TabButton active={tab === 'overdue'} onClick={() => setTab('overdue')} label="Overdue"  count={overdue.length}  tone="risk" />
        <TabButton active={tab === 'today'}   onClick={() => setTab('today')}   label="Today"    count={dueToday.length} tone="warn" />
      </div>

      {/* LIST */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-ink-200/70 rounded-xl px-6 py-12 text-center">
          <Phone className="w-8 h-8 text-ink-300 mx-auto mb-3" />
          <div className="text-[14.5px] font-medium text-ink-800 mb-1">
            {tab === 'overdue' ? 'No overdue follow-ups' : tab === 'today' ? 'No follow-ups due today' : 'No active follow-ups'}
          </div>
          <div className="text-[12.5px] text-ink-500">
            When you log a call with a "Next action" + due date, it shows up here on the due date.
          </div>
        </div>
      ) : (
        <div className="bg-white border border-ink-200/70 rounded-xl overflow-hidden">
          {filtered.map((f, idx) => {
            const daysDiff = Math.floor((new Date(f.next_action_due).getTime() - todayMs) / 86400000);
            const isOverdue = daysDiff < 0;
            let dueLabel = '';
            if (daysDiff < 0) dueLabel = `${Math.abs(daysDiff)}d overdue`;
            else if (daysDiff === 0) dueLabel = 'Due today';
            else dueLabel = `In ${daysDiff}d`;

            const isLast = idx === filtered.length - 1;
            return (
              <Link
                key={f.id}
                href={`/students?student=${f.student_id}` as any}
                className={
                  'block px-5 py-4 hover:bg-ink-50/60 ' +
                  (isLast ? '' : 'border-b border-ink-100')
                }
              >
                <div className="flex items-start gap-3">
                  <StudentAvatar first={f.student_first} last={f.student_last} size={36} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <div className="font-semibold text-[13.5px] text-ink-900">{f.student_first} {f.student_last}</div>
                      <div className="text-[11px] text-ink-500">{f.student_mobile ?? f.student_email}</div>
                    </div>
                    <div className="text-[13px] text-ink-700 mb-1.5">
                      <span className="font-medium">→</span> {f.next_action}
                    </div>
                    <div className="text-[11.5px] text-ink-500 line-clamp-1">
                      From call on {fmtDate(f.created_at)}{f.coach_name ? ` · ${f.coach_name}` : ''}{f.outcome ? ` · ${f.outcome.replace(/_/g, ' ')}` : ''}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={
                      'text-[12px] font-semibold ' +
                      (isOverdue ? 'text-rose-700' : 'text-amber-700')
                    }>{dueLabel}</div>
                    <div className="text-[11px] text-ink-500 mt-0.5">{fmtDate(f.next_action_due)}</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

function TabButton({ active, onClick, label, count, tone }: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  tone?: 'risk' | 'warn';
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'h-8 px-3 rounded-md text-[12.5px] font-medium flex items-center gap-1.5 transition',
        active ? 'bg-ink-900 text-white' : 'text-ink-700 hover:bg-ink-100'
      )}
    >
      {label}
      {count > 0 && (
        <span className={cn(
          'text-[10.5px] font-semibold px-1.5 py-0.5 rounded',
          active ? 'bg-white/20 text-white' :
          tone === 'risk' ? 'bg-rose-100 text-rose-700' :
          tone === 'warn' ? 'bg-amber-100 text-amber-800' :
          'bg-ink-100 text-ink-700'
        )}>{count}</span>
      )}
    </button>
  );
}