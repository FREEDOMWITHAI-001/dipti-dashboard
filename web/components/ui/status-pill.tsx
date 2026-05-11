import { cn } from '@/lib/utils';

type Status =
  | 'active' | 'expiring' | 'expired'
  | 'upcoming' | 'due_soon' | 'overdue' | 'paid' | 'cancelled';

const config: Record<Status, { label: string; cls: string }> = {
  active:    { label: 'Active',    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  expiring:  { label: 'Expiring',  cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  expired:   { label: 'Expired',   cls: 'bg-ink-100 text-ink-600 border-ink-200' },
  upcoming:  { label: 'Upcoming',  cls: 'bg-ink-100 text-ink-700 border-ink-200' },
  due_soon:  { label: 'Due soon',  cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  overdue:   { label: 'Overdue',   cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  paid:      { label: 'Paid',      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelled: { label: 'Cancelled', cls: 'bg-ink-100 text-ink-500 border-ink-200' },
};

export function StatusPill({ status, label }: { status: string; label?: string }) {
  const s = (config as any)[status] ?? { label: status, cls: 'bg-ink-100 text-ink-700 border-ink-200' };
  return (
    <span className={cn('inline-flex items-center px-2 h-5 text-[10.5px] font-medium rounded-full border', s.cls)}>
      {label ?? s.label}
    </span>
  );
}
