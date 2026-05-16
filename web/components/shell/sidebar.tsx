'use client';
 
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  UsersRound, IndianRupee, BellRing, Phone, LineChart, Settings2, Link2,
  ChevronUp, MessageSquare, CalendarClock, TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
 
type SessionUser = {
  email: string;
  displayName: string;
  initials: string;
  role: 'coach' | 'admin';
} | null;
 
type Badges = { emi: number; calls: number };
 
const NAV: Array<{ href: string; label: string; icon: any; badgeKey?: keyof Badges; tone?: 'risk' | 'muted' }> = [
  { href: '/students',   label: 'Students',     icon: UsersRound },
  { href: '/emi',        label: 'EMI Tracker',  icon: IndianRupee, badgeKey: 'emi',   tone: 'risk' },
  { href: '/progress',   label: 'Progress',     icon: TrendingUp },
  { href: '/follow-ups', label: 'Follow-ups',   icon: CalendarClock },
  { href: '/reminders',  label: 'Reminders',    icon: BellRing },
  { href: '/calls',      label: 'Call Queue',   icon: Phone,       badgeKey: 'calls', tone: 'muted' },
  { href: '/comments',   label: 'Comments',     icon: MessageSquare },
  { href: '/reports',    label: 'Reports',      icon: LineChart },
];
 
export function Sidebar({ user, badges }: { user: SessionUser; badges: Badges }) {
  const pathname = usePathname();
  const avatarClass = avClassForInitials(user?.initials ?? '');
 
  return (
    <aside className="w-[244px] shrink-0 bg-white border-r border-ink-200/70 flex flex-col">
      <div className="h-16 px-5 flex items-center gap-3 border-b border-ink-200/70">
        <div className="w-8 h-8 rounded-lg bg-ink-900 text-white grid place-items-center font-semibold tracking-tight">D</div>
        <div className="leading-tight">
          <div className="font-semibold text-[14px]">DVA Operations</div>
          <div className="text-[11px] text-ink-500 -mt-0.5">Diamond program</div>
        </div>
      </div>
 
      <nav className="px-3 py-3 flex-1 space-y-0.5 text-[13.5px]">
        {NAV.map(({ href, label, icon: Icon, badgeKey, tone }) => {
          const active = pathname === href || pathname?.startsWith(href + '/');
          const count = badgeKey ? badges[badgeKey] : 0;
          const showBadge = badgeKey && count > 0;
          return (
            <Link
              key={href}
              href={href as any}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg',
                active ? 'font-medium text-ink-900 bg-ink-100' : 'text-ink-700 hover:bg-ink-100/70'
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
              {showBadge ? (
                <span className={cn(
                  'ml-auto text-[11px] font-medium rounded px-1.5 py-0.5',
                  tone === 'risk' ? 'bg-rose-50 text-rose-700' : 'text-ink-500 font-normal'
                )}>{count}</span>
              ) : null}
            </Link>
          );
        })}
 
        <div className="pt-4 pb-1.5 px-3 text-[10.5px] uppercase tracking-wider text-ink-400 font-semibold">
          Workspace
        </div>
        <Link href={'/settings' as any} className={cn(
          'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg',
          pathname === '/settings' ? 'font-medium text-ink-900 bg-ink-100' : 'text-ink-700 hover:bg-ink-100/70'
        )}>
          <Settings2 className="w-4 h-4" /> <span>Settings</span>
        </Link>
        <Link href={'/settings/ghl' as any} className={cn(
          'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg',
          pathname?.startsWith('/settings/ghl') ? 'font-medium text-ink-900 bg-ink-100' : 'text-ink-700 hover:bg-ink-100/70'
        )}>
          <Link2 className="w-4 h-4" /> <span>GHL Integration</span>
          <span className="ml-auto inline-flex items-center gap-1 text-[10.5px] text-emerald-700">
            <span className="dot bg-emerald-500" /> live
          </span>
        </Link>
      </nav>
 
      <Link
        href={'/settings' as any}
        className="m-3 px-3 py-2.5 rounded-xl bg-ink-50/70 hover:bg-ink-100 border border-ink-200/60 flex items-center gap-3 text-left transition group"
      >
        <span className="relative inline-block shrink-0">
          <span className={cn('w-9 h-9 rounded-full grid place-items-center text-[13px] font-semibold', avatarClass)}>
            {user?.initials ?? '?'}
          </span>
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-ink-50/70 group-hover:ring-ink-100 transition" />
        </span>
        <span className="leading-tight flex-1 min-w-0">
          <span className="block text-[13.5px] font-semibold text-ink-900 truncate">{user?.displayName ?? 'Guest'}</span>
          <span className="text-[11px] text-ink-500 inline-flex items-center gap-1.5">
            {user ? (user.role === 'admin' ? 'Admin' : 'Coach') : 'Not signed in'}
            <span className="w-0.5 h-0.5 rounded-full bg-ink-300" />
            Online
          </span>
        </span>
        <ChevronUp className="w-4 h-4 text-ink-400 group-hover:text-ink-700 transition" />
      </Link>
    </aside>
  );
}
 
const PRESETS = ['av-AK', 'av-DV', 'av-FM', 'av-S'];
function avClassForInitials(initials: string): string {
  if (!initials) return 'bg-ink-900 text-white';
  const exact = `av-${initials.toUpperCase().slice(0, 2)}`;
  if (PRESETS.includes(exact)) return exact;
  const sum = initials.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return PRESETS[sum % PRESETS.length];
}