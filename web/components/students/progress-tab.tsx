'use client';

import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
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
  const completed = months.filter((m) => student[m]).length;
  const [busy, setBusy] = useState<MonthKey | null>(null);

  async function toggle(m: MonthKey) {
    const next = !student[m];
    // Optimistic update — flip in parent state immediately so UI feels instant.
    onChange?.({ [m]: next } as Partial<Student>);
    setBusy(m);
    const { error } = await sb.from('students').update({ [m]: next } as any).eq('id', student.id);
    setBusy(null);
    if (error) {
      // Roll back optimistic update.
      onChange?.({ [m]: !next } as Partial<Student>);
      toast(error.message, 'error');
      return;
    }
    toast(`Month ${m.replace('month_', '')} ${next ? 'completed' : 'unmarked'}`, 'success');
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-ink-200/70 rounded-xl p-5">
        <div className="flex items-end justify-between mb-3">
          <div>
            <div className="text-[12px] text-ink-500 font-medium">Course completion</div>
            <div className="text-[28px] font-semibold tracking-tight leading-none mt-1">
              {completed} <span className="text-ink-400 font-normal text-[18px]">/ 6 months</span>
            </div>
          </div>
          <div className="text-[11.5px] text-ink-500">{Math.round(completed / 6 * 100)}% complete</div>
        </div>
        <div className="flex items-center gap-1.5">
          {months.map((m) => (
            <div key={m} className={cn('flex-1 h-1.5 rounded-full transition-colors', student[m] ? 'bg-emerald-500' : 'bg-ink-200')} />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-6 gap-1.5 text-[11px] text-center text-ink-500">
          {months.map((m, i) => (
            <div key={m} className={cn('py-1 rounded transition-colors', student[m] ? 'bg-emerald-50 text-emerald-700 font-medium' : 'bg-ink-50')}>
              M{i + 1}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-ink-200/70 rounded-xl p-5">
        <h3 className="text-[14px] font-semibold mb-3">Monthly checkpoints</h3>
        <p className="text-[12px] text-ink-500 mb-3 -mt-2">Click to mark a month complete. Changes save automatically.</p>
        <div className="space-y-1.5">
          {months.map((m, i) => {
            const isOn = !!student[m];
            const isBusy = busy === m;
            return (
              <button
                key={m}
                onClick={() => !isBusy && toggle(m)}
                disabled={isBusy}
                className={cn(
                  'w-full flex items-center gap-3 py-2 px-3 rounded-lg text-left transition',
                  isOn ? 'bg-emerald-50/40 hover:bg-emerald-50/70' : 'hover:bg-ink-50',
                  isBusy && 'opacity-60'
                )}
              >
                <span className={cn('w-5 h-5 rounded grid place-items-center shrink-0 transition', isOn ? 'bg-emerald-500' : 'bg-white border border-ink-300')}>
                  {isBusy ? <Loader2 className="w-3 h-3 text-ink-500 animate-spin" />
                    : isOn ? <Check className="w-3 h-3 text-white" /> : null}
                </span>
                <span className="text-[13.5px] font-medium">Month {i + 1}</span>
                <span className={cn('ml-auto text-[11.5px]', isOn ? 'text-emerald-700 font-medium' : 'text-ink-500')}>
                  {isOn ? 'Completed' : 'Pending'}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
