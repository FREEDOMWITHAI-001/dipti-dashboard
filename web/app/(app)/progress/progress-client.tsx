'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { StudentAvatar } from '@/components/ui/avatar';
import { fmtDate } from '@/lib/utils';
import { Users, AlertTriangle } from 'lucide-react';

type StudentRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  start_date: string | null;
  completed_months: number;
  next_due_month: number;
  stuck_since_date: string;
  days_stuck: number;
};

type MonthStat = {
  month: number;
  stuck: StudentRow[];
};

export function ProgressClient({ students }: { students: any[] }) {
  const [selectedMonth, setSelectedMonth] = useState<number>(0);

  // Compute month stats ONCE — only stuck students are bucketed.
  const { monthStats, totalStuck, notStartedCount } = useMemo(() => {
    const stats: MonthStat[] = [1, 2, 3, 4, 5, 6].map((m) => ({ month: m, stuck: [] }));
    let notStarted = 0;
    let stuckTotal = 0;
    const todayMs = Date.now();

    for (const s of students) {
      if (!s.start_date) { notStarted++; continue; }
      const startMs = new Date(s.start_date).getTime();
      if (startMs > todayMs) continue;

      const checkpoints = [s.month_1, s.month_2, s.month_3, s.month_4, s.month_5, s.month_6];
      const completedMonths = checkpoints.filter((c) => c === true).length;

      // Skip students who have completed everything
      if (completedMonths === 6) continue;

      // Which month they're working on
      const bucketMonth = completedMonths + 1;
      const deadlineMs = startMs + bucketMonth * 30 * 86400000;

      // ONLY include stuck students — skip those still within deadline
      if (todayMs <= deadlineMs) continue;

      const stuckSinceDate = new Date(deadlineMs).toISOString().slice(0, 10);
      const daysStuck = Math.floor((todayMs - deadlineMs) / 86400000);

      const row: StudentRow = {
        id: s.id,
        first_name: s.first_name,
        last_name: s.last_name,
        start_date: s.start_date,
        completed_months: completedMonths,
        next_due_month: bucketMonth,
        stuck_since_date: stuckSinceDate,
        days_stuck: daysStuck,
      };

      stats[bucketMonth - 1].stuck.push(row);
      stuckTotal++;
    }

    return { monthStats: stats, totalStuck: stuckTotal, notStartedCount: notStarted };
  }, [students]);

  const selectedMonthData = selectedMonth > 0 ? monthStats[selectedMonth - 1] : null;

  return (
    <>
      {/* Single big KPI for total stuck */}
      <div className="mb-8">
        <div className="bg-white border border-ink-200 rounded-xl p-5 max-w-[280px]">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span className="text-[11.5px] uppercase tracking-wider font-semibold text-ink-500">Total stuck</span>
          </div>
          <div className="text-[30px] font-bold leading-none text-rose-700">{totalStuck}</div>
          <div className="text-[11.5px] text-ink-500 mt-1.5 font-medium">need coach attention</div>
        </div>
      </div>

      <div className="mb-3">
        <h2 className="text-[12px] uppercase tracking-wider font-semibold text-ink-500">Stuck students by month</h2>
      </div>

      {/* Month cards — show only stuck counts */}
      <div className="grid grid-cols-6 gap-3 mb-8">
        {monthStats.map((m) => {
          const isSelected = selectedMonth === m.month;
          const total = m.stuck.length;
          return (
            <button
              key={m.month}
              type="button"
              onClick={() => setSelectedMonth(isSelected ? 0 : m.month)}
              className={
                'rounded-xl border p-4 transition text-left ' +
                (isSelected
                  ? 'border-accent-500 bg-accent-50/40 ring-1 ring-accent-100'
                  : 'border-ink-200 bg-white hover:border-ink-300 hover:bg-ink-50/40')
              }
            >
              <div className="text-[11px] uppercase tracking-wider font-semibold mb-2 text-ink-500">
                Month {m.month}
              </div>
              <div className={
                'text-[28px] font-bold leading-none mb-2 ' +
                (total > 0 ? 'text-rose-700' : 'text-ink-300')
              }>
                {total}
              </div>
              <div className="text-[11px] text-ink-500 font-medium">
                {total === 0 ? 'none stuck' : total === 1 ? 'student stuck' : 'students stuck'}
              </div>
            </button>
          );
        })}
      </div>

      {/* Details for selected month */}
      {selectedMonthData ? (
        <div>
          <div className="flex items-baseline justify-between mb-4">
            <div>
              <h2 className="text-[20px] font-semibold tracking-tight text-ink-900">Month {selectedMonthData.month} — stuck</h2>
              <p className="text-[12.5px] text-ink-500 mt-0.5">
                {selectedMonthData.stuck.length} {selectedMonthData.stuck.length === 1 ? 'student is' : 'students are'} behind on their Month {selectedMonthData.month} checkpoint
              </p>
            </div>
            <button onClick={() => setSelectedMonth(0)} className="text-[12px] text-ink-500 hover:text-ink-800 transition">
              Clear filter ✕
            </button>
          </div>

          {selectedMonthData.stuck.length === 0 ? (
            <EmptyCard message={`No stuck students in Month ${selectedMonthData.month}`} />
          ) : (
            <div className="bg-white border border-ink-200 rounded-xl overflow-hidden">
              {selectedMonthData.stuck
                .sort((a, b) => b.days_stuck - a.days_stuck)
                .map((s, idx) => {
                  const isLast = idx === selectedMonthData.stuck.length - 1;
                  return (
                    <Link
                      key={s.id}
                      href={`/students?student=${s.id}` as any}
                      className={'block px-5 py-3.5 transition hover:bg-ink-50/60 ' + (isLast ? '' : 'border-b border-ink-100')}
                    >
                      <div className="flex items-center gap-3.5">
                        <StudentAvatar first={s.first_name} last={s.last_name} size={38} />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-[14px] text-ink-900 leading-tight">{s.first_name} {s.last_name}</div>
                          <div className="text-[11.5px] text-ink-500 mt-0.5">
                            Started {fmtDate(s.start_date)} · {s.completed_months}/6 done
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[13px] font-semibold text-rose-700 leading-tight">
                            Stuck since {fmtDate(s.stuck_since_date)}
                          </div>
                          <div className="text-[11px] text-rose-600 mt-0.5 font-medium">
                            {s.days_stuck} days behind
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
            </div>
          )}
        </div>
      ) : (
        <EmptyCard
          message="Click any month above to see the stuck students"
          subtitle="Each row shows when the checkpoint was due and how many days behind they are."
        />
      )}

      {notStartedCount > 0 && (
        <div className="mt-6 text-[11.5px] text-ink-400">
          {notStartedCount} students don't have a start date set — not counted above.
        </div>
      )}
    </>
  );
}

function EmptyCard({ message, subtitle }: { message: string; subtitle?: string }) {
  return (
    <div className="bg-white border border-dashed border-ink-300 rounded-xl px-6 py-10 text-center">
      <Users className="w-7 h-7 text-ink-300 mx-auto mb-3" />
      <div className="text-[13.5px] font-semibold text-ink-900">{message}</div>
      {subtitle && <div className="text-[12px] text-ink-500 mt-1.5 max-w-md mx-auto">{subtitle}</div>}
    </div>
  );
}