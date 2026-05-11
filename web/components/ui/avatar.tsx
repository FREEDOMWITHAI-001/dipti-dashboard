import { cn } from '@/lib/utils';

const PRESETS = ['av-AK', 'av-DV', 'av-FM', 'av-S'];

function classForInitials(initials: string): string {
  if (!initials) return 'bg-ink-900 text-white';
  const exact = `av-${initials.toUpperCase().slice(0, 2)}`;
  if (PRESETS.includes(exact)) return exact;
  const sum = initials.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return PRESETS[sum % PRESETS.length];
}

function initialsOf(first?: string | null, last?: string | null): string {
  const f = (first ?? '').trim();
  const l = (last  ?? '').trim();
  if (f && l) return (f[0] + l[0]).toUpperCase();
  if (f) return f.slice(0, 2).toUpperCase();
  if (l) return l.slice(0, 2).toUpperCase();
  return '?';
}

export function StudentAvatar({
  first, last, size = 32,
}: {
  first?: string | null;
  last?: string | null;
  size?: number;
}) {
  const initials = initialsOf(first, last);
  return (
    <span
      className={cn('inline-flex items-center justify-center rounded-full font-semibold shrink-0', classForInitials(initials))}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {initials}
    </span>
  );
}

export function CoachAvatar({
  initials, size = 28,
}: {
  initials: string;
  size?: number;
}) {
  return (
    <span
      className={cn('inline-flex items-center justify-center rounded-full font-semibold shrink-0', classForInitials(initials))}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {initials || '?'}
    </span>
  );
}
