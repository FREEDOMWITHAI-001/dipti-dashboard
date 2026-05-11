import * as Icons from 'lucide-react';
import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'good' | 'warn' | 'risk';

const toneClasses: Record<Tone, { icon: string; sub: string }> = {
  neutral: { icon: 'bg-ink-100 text-ink-700',             sub: 'text-ink-500' },
  good:    { icon: 'bg-emerald-50 text-emerald-700',       sub: 'text-emerald-700' },
  warn:    { icon: 'bg-amber-50 text-amber-700',           sub: 'text-amber-700' },
  risk:    { icon: 'bg-rose-50 text-rose-700',             sub: 'text-rose-700' },
};

export function KpiCard({
  label, value, sub, icon, tone = 'neutral',
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: keyof typeof Icons;
  tone?: Tone;
}) {
  const Icon = icon ? (Icons[icon] as any) : null;
  const t = toneClasses[tone];

  return (
    <div className="bg-white border border-ink-200/70 rounded-xl p-4 flex flex-col gap-2 h-full">
      <div className="flex items-center justify-between">
        <span className="text-[11.5px] uppercase tracking-wider font-semibold text-ink-500">{label}</span>
        {Icon && (
          <span className={cn('w-7 h-7 rounded-md grid place-items-center', t.icon)}>
            <Icon className="w-3.5 h-3.5" />
          </span>
        )}
      </div>
      <div className="text-[24px] font-semibold tracking-tight leading-tight">{value}</div>
      {sub && <div className={cn('text-[11.5px]', t.sub)}>{sub}</div>}
    </div>
  );
}
