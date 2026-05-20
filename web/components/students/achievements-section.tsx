'use client';

import { useState } from 'react';
import { Trophy, Award, Calendar, FileText, GraduationCap, Check, Clock, Loader2 } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useToast } from '@/components/shell/toast-region';
import { cn } from '@/lib/utils';
import type { Database } from '@/types/database';

type Student = Database['public']['Tables']['students']['Row'] & {
  is_super_baker_finisher?: boolean;
  is_hall_of_fame?: boolean;
  certificate_issued?: boolean;
  certificate_issued_date?: string | null;
  bbr_attended?: boolean;
  bbr_attended_date?: string | null;
};

export function AchievementsSection({ 
  student, 
  onChange 
}: { 
  student: Student; 
  onChange?: (patch: Partial<Student>) => void;
}) {
  const sb = supabaseBrowser();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  // Compute 6 Month Challenge completion
  const monthsComplete = [
    student.month_1, student.month_2, student.month_3,
    student.month_4, student.month_5, student.month_6
  ].filter(Boolean).length;
  const sixMonthCompleted = monthsComplete === 6;

  // Certificate pending = 6 months done but cert not issued
  const certificatePending = sixMonthCompleted && !student.certificate_issued;

  async function toggleField(field: keyof Student, label: string) {
    const next = !(student as any)[field];
    setBusy(field as string);
    onChange?.({ [field]: next } as Partial<Student>);
    
    const updates: any = { [field]: next };
    // Auto-set date when marking certificate or BBR as true
    if (field === 'certificate_issued' && next) {
      updates.certificate_issued_date = new Date().toISOString().slice(0, 10);
    }
    if (field === 'bbr_attended' && next) {
      updates.bbr_attended_date = new Date().toISOString().slice(0, 10);
    }
    
    const { error } = await sb.from('students').update(updates).eq('id', student.id);
    setBusy(null);
    
    if (error) {
      onChange?.({ [field]: !next } as Partial<Student>);
      toast(error.message, 'error');
      return;
    }
    if (updates.certificate_issued_date) onChange?.(updates);
    if (updates.bbr_attended_date) onChange?.(updates);
    toast(`${label} ${next ? 'marked' : 'unmarked'}`, 'success');
  }

  const achievements = [
    {
      key: 'super_baker',
      label: 'Super Baker Finisher',
      icon: Trophy,
      iconColor: 'text-amber-500',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      active: !!student.is_super_baker_finisher,
      pending: false,
      onToggle: () => toggleField('is_super_baker_finisher', 'Super Baker'),
      field: 'is_super_baker_finisher',
    },
    {
      key: 'hof',
      label: 'Hall of Fame',
      icon: Award,
      iconColor: 'text-purple-500',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      active: !!student.is_hall_of_fame,
      pending: false,
      onToggle: () => toggleField('is_hall_of_fame', 'Hall of Fame'),
      field: 'is_hall_of_fame',
    },
    {
      key: 'six_month',
      label: '6 Month Challenge',
      icon: Calendar,
      iconColor: 'text-emerald-500',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
      active: sixMonthCompleted,
      pending: false,
      readonly: true,
      subtitle: `${monthsComplete}/6 months complete`,
    },
    {
      key: 'certificate',
      label: 'Certificate',
      icon: FileText,
      iconColor: certificatePending ? 'text-orange-500' : 'text-blue-500',
      bgColor: certificatePending ? 'bg-orange-50' : 'bg-blue-50',
      borderColor: certificatePending ? 'border-orange-200' : 'border-blue-200',
      active: !!student.certificate_issued,
      pending: certificatePending,
      onToggle: () => toggleField('certificate_issued', 'Certificate'),
      field: 'certificate_issued',
      subtitle: student.certificate_issued && student.certificate_issued_date 
        ? `Issued ${formatDate(student.certificate_issued_date)}` 
        : certificatePending 
          ? 'Pending — 6 months done, awaiting certificate'
          : undefined,
    },
    {
      key: 'bbr',
      label: 'BBR Attended',
      icon: GraduationCap,
      iconColor: 'text-indigo-500',
      bgColor: 'bg-indigo-50',
      borderColor: 'border-indigo-200',
      active: !!student.bbr_attended,
      pending: false,
      onToggle: () => toggleField('bbr_attended', 'BBR'),
      field: 'bbr_attended',
      subtitle: student.bbr_attended && student.bbr_attended_date 
        ? `Attended ${formatDate(student.bbr_attended_date)}` 
        : undefined,
    },
  ];

  const totalAchieved = achievements.filter(a => a.active).length;

  return (
    <div className="bg-white border border-ink-200/70 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[14px] font-semibold flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          Achievements
        </h3>
        <span className="text-[11.5px] text-ink-500 font-medium">
          {totalAchieved} of {achievements.length}
        </span>
      </div>
      
      <div className="space-y-1.5">
        {achievements.map((a) => {
          const Icon = a.icon;
          const isBusy = busy === a.field;
          return (
            <button
              key={a.key}
              onClick={a.readonly ? undefined : a.onToggle}
              disabled={isBusy || a.readonly}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all',
                a.active ? `${a.bgColor} ${a.borderColor}` : 'bg-ink-50/50 border-ink-200/50',
                !a.readonly && 'hover:border-ink-300 cursor-pointer',
                a.readonly && 'cursor-default',
                isBusy && 'opacity-60'
              )}
            >
              <div className={cn(
                'w-9 h-9 rounded-md grid place-items-center flex-shrink-0',
                a.active ? 'bg-white' : 'bg-ink-100'
              )}>
                {isBusy ? (
                  <Loader2 className="w-4 h-4 animate-spin text-ink-400" />
                ) : (
                  <Icon className={cn('w-4 h-4', a.active ? a.iconColor : 'text-ink-300')} />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className={cn(
                  'text-[13px] font-medium',
                  a.active ? 'text-ink-900' : 'text-ink-500'
                )}>
                  {a.label}
                </div>
                {a.subtitle && (
                  <div className={cn(
                    'text-[11px] mt-0.5',
                    a.pending ? 'text-orange-700 font-medium' : 'text-ink-500'
                  )}>
                    {a.subtitle}
                  </div>
                )}
              </div>
              
              <div className="flex-shrink-0">
                {a.active ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10.5px] font-semibold">
                    <Check className="w-3 h-3" />
                    Achieved
                  </span>
                ) : a.pending ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[10.5px] font-semibold">
                    <Clock className="w-3 h-3" />
                    Pending
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-ink-100 text-ink-500 text-[10.5px] font-medium">
                    —
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      
      {!student.month_6 && (
        <p className="text-[11px] text-ink-500 mt-3 leading-relaxed">
          💡 6 Month Challenge auto-completes when all monthly checkpoints are marked.
        </p>
      )}
    </div>
  );
}

function formatDate(d: string): string {
  try {
    const date = new Date(d);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
}