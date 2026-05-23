'use client';

import { useState, useEffect } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useToast } from '@/components/shell/toast-region';
import { cn } from '@/lib/utils';
import type { Database } from '@/types/database';

type Student = Database['public']['Tables']['students']['Row'];
type MonthKey = 'month_1' | 'month_2' | 'month_3' | 'month_4' | 'month_5' | 'month_6';

export function ProgressTab({
  student,
  onChange,
}: {
  student: Student;
  onChange?: (patch: Partial<Student>) => void;
}) {
  const sb = supabaseBrowser();
  const { toast } = useToast();
  const months: MonthKey[] = ['month_1', 'month_2', 'month_3', 'month_4', 'month_5', 'month_6'];
  const [weeks, setWeeks] = useState<Set<number>>(new Set());
  const [busyWeek, setBusyWeek] = useState<number | null>(null);

  // Fetch weekly checkpoints (the source of truth — months are derived from these)
  async function loadWeeks() {
    const { data } = await sb
      .from('weekly_checkpoints')
      .select('week_no, completed')
      .eq('student_id', student.id);
    const done = new Set<number>();
    for (const w of (data ?? []) as any[]) {
      if (w.completed) done.add(w.week_no);
    }
    setWeeks(done);
  }
  useEffect(() => { loadWeeks().catch(() => {}); /* eslint-disable-next-line */ }, [student.id]);

  // A month is complete when ALL 4 of its weeks are complete (auto-computed)
  function monthComplete(monthIdx: number): boolean {
    const start = monthIdx * 4 + 1;
    return [start, start + 1, start + 2, start + 3].every((wn) => weeks.has(wn));
  }
  const completed = months.filter((_, i) => monthComplete(i)).length;

  // Toggle an individual week (manual). Month auto-recomputes from weeks.
  async function toggleWeek(wn: number) {
    const isDone = weeks.has(wn);
    const next = !isDone;

    // Optimistic UI
    const optimistic = new Set(weeks);
    if (next) optimistic.add(wn); else optimistic.delete(wn);
    setWeeks(optimistic);
    setBusyWeek(wn);

    const { error } = await sb
      .from('weekly_checkpoints')
      .upsert({ student_id: student.id, week_no: wn, completed: next } as any, { onConflict: 'student_id,week_no' });
    setBusyWeek(null);

    if (error) {
      // rollback
      setWeeks(new Set(weeks));
      toast(error.message, 'error');
      return;
    }

    // Recompute the affected month from the new week set, push to parent so
    // other tabs / Achievements (6-month challenge, certificate lock) stay in sync.
    const monthIdx = Math.floor((wn - 1) / 4);
    const start = monthIdx * 4 + 1;
    const monthNowDone = [start, start + 1, start + 2, start + 3].every((w) => optimistic.has(w));
    const monthKey = `month_${monthIdx + 1}` as MonthKey;
    if (!!student[monthKey] !== monthNowDone) {
      onChange?.({ [monthKey]: monthNowDone } as Partial<Student>);
    }

    toast(`Week ${wn} ${next ? 'completed' : 'unmarked'}`, 'success');
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-white border border-ink-200/70 rounded-xl p-5">
        <div className="flex items-end justify-between mb-3">
          <div>
            <div className="text-[12px] text-ink-500 font-medium">Course completion</div>
            <div className="text-[28px] font-semibold tracking-tight leading-none mt-1">
              {completed} <span className="text-ink-400 font-normal text-[18px]">/ 6 months</span>
            </div>
          </div>
          <div className="text-[11.5px] text-ink-500">{weeks.size} / 24 weeks &middot; {Math.round(completed / 6 * 100)}%</div>
        </div>
        <div className="flex items-center gap-1.5">
          {months.map((m, i) => (
            <div key={m} className={cn('flex-1 h-1.5 rounded-full transition-colors', monthComplete(i) ? 'bg-emerald-500' : 'bg-ink-200')} />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-6 gap-1.5 text-[11px] text-center text-ink-500">
          {months.map((m, i) => (
            <div key={m} className={cn('py-1 rounded transition-colors', monthComplete(i) ? 'bg-emerald-50 text-emerald-700 font-medium' : 'bg-ink-50')}>
              M{i + 1}
            </div>
          ))}
        </div>
      </div>

      {/* Weekly checkpoints — MANUALLY CLICKABLE */}
      <div className="bg-white border border-ink-200/70 rounded-xl p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[14px] font-semibold">Weekly checkpoints</h3>
          <span className="text-[11.5px] text-ink-500">{weeks.size} / 24 weeks</span>
        </div>
        <p className="text-[12px] text-ink-500 mb-3">Click any week to mark it complete. Completing all 4 weeks marks the month done.</p>
        <div className="space-y-2">
          {months.map((m, mi) => {
            const monthDone = monthComplete(mi);
            const weekNums = [mi * 4 + 1, mi * 4 + 2, mi * 4 + 3, mi * 4 + 4];
            return (
              <div key={m} className="flex items-center gap-2">
                <span className={cn('text-[11px] w-12 font-medium', monthDone ? 'text-emerald-700' : 'text-ink-400')}>
                  M{mi + 1}
                </span>
                <div className="flex gap-1.5 flex-1">
                  {weekNums.map((wn) => {
                    const done = weeks.has(wn);
                    const wBusy = busyWeek === wn;
                    return (
                      <button
                        key={wn}
                        onClick={() => !wBusy && toggleWeek(wn)}
                        disabled={wBusy}
                        className={cn(
                          'flex-1 h-7 rounded grid place-items-center text-[10.5px] font-medium transition cursor-pointer',
                          done ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-ink-100 text-ink-400 hover:bg-ink-200',
                          wBusy && 'opacity-50'
                        )}
                        title={`Week ${wn}`}
                      >
                        {wBusy ? '…' : `W${wn}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}