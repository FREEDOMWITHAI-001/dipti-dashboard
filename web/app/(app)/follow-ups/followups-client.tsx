'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { StudentAvatar } from '@/components/ui/avatar';
import { fmtDate, cn } from '@/lib/utils';
import { Phone, Search, X, CheckCircle2 } from 'lucide-react';

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
  is_completed: boolean;
  completed_at: string | null;
};

type Tab = 'pending' | 'overdue' | 'today' | 'completed';

// next_action_due is already stored as YYYY-MM-DD, so plain string compares work
// for the date-range filter. shortDate just prettifies it for display, matching
// the 30 Day Follow-up page.
function shortDate(s: string): string {
  return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function FollowupsClient({ initialItems }: { initialItems: FollowUp[] }) {
  const [tab, setTab] = useState<Tab>('pending');
  // Filters are additive and default to "off" — the tab still drives the default
  // view, so existing behaviour is unchanged until the user types/picks a range.
  const [query, setQuery] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const today = new Date().toISOString().slice(0, 10);

  // Split items into pending vs completed (unchanged behaviour)
  const pendingItems = useMemo(
    () => initialItems.filter((f) => !f.is_completed && f.next_action_due <= today),
    [initialItems, today]
  );
  const completedItems = useMemo(
    () => initialItems.filter((f) => f.is_completed),
    [initialItems]
  );
  const overdueItems = useMemo(
    () => pendingItems.filter((f) => f.next_action_due < today),
    [pendingItems, today]
  );
  const todayItems = useMemo(
    () => pendingItems.filter((f) => f.next_action_due === today),
    [pendingItems, today]
  );

  const base: FollowUp[] =
    tab === 'pending' ? pendingItems :
    tab === 'overdue' ? overdueItems :
    tab === 'today' ? todayItems :
    completedItems;

  // Apply the search + date-range filters on top of the active tab.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return base.filter((f) => {
      if (from && f.next_action_due < from) return false;
      if (to && f.next_action_due > to) return false;
      if (q) {
        const name = `${f.student_first ?? ''} ${f.student_last ?? ''}`.toLowerCase();
        const phone = (f.student_mobile ?? '').toLowerCase();
        const email = (f.student_email ?? '').toLowerCase();
        const action = (f.next_action ?? '').toLowerCase();
        if (!name.includes(q) && !phone.includes(q) && !email.includes(q) && !action.includes(q)) return false;
      }
      return true;
    });
  }, [base, query, from, to]);

  const filtersActive = !!query || !!from || !!to;

  return (
    <>
      {/* Filter tabs (unchanged) */}
      <div className="bg-white border border-ink-200/70 rounded-xl mb-4 p-1.5 flex items-center gap-1 w-fit">
        <TabButton active={tab === 'pending'}   onClick={() => setTab('pending')}   label="All pending" count={pendingItems.length} />
        <TabButton active={tab === 'overdue'}   onClick={() => setTab('overdue')}   label="Overdue"     count={overdueItems.length}   tone="risk" />
        <TabButton active={tab === 'today'}     onClick={() => setTab('today')}     label="Today"       count={todayItems.length}     tone="warn" />
        <TabButton active={tab === 'completed'} onClick={() => setTab('completed')} label="Completed"   count={completedItems.length} tone="good" />
      </div>

      {/* Toolbar: search + date range (matches the 30 Day Follow-up page) */}
      <div className="flex flex-wrap items-end gap-2.5 mb-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, phone, or action…"
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-ink-200 bg-white text-[13px] focus:outline-none focus:border-accent-500"
          />
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-[11.5px] font-medium text-ink-600">Start date</span>
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
            className="h-9 px-2.5 rounded-lg border border-ink-200 bg-white text-[13px] focus:outline-none focus:border-accent-500"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11.5px] font-medium text-ink-600">End date</span>
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
            className="h-9 px-2.5 rounded-lg border border-ink-200 bg-white text-[13px] focus:outline-none focus:border-accent-500"
          />
        </label>
        {filtersActive && (
          <button
            onClick={() => { setQuery(''); setFrom(''); setTo(''); }}
            className="h-9 self-end px-3 rounded-lg border border-ink-200 bg-white hover:bg-ink-50 text-[12.5px] font-medium inline-flex items-center gap-1.5"
          >
            <X className="w-3.5 h-3.5" /> Reset
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-ink-200/70 rounded-xl px-6 py-12 text-center">
          <Phone className="w-8 h-8 text-ink-300 mx-auto mb-3" />
          <div className="text-[14.5px] font-medium text-ink-800 mb-1">
            {filtersActive ? 'No follow-ups match your filters' :
             tab === 'overdue' ? 'No overdue follow-ups' :
             tab === 'today' ? 'No follow-ups due today' :
             tab === 'completed' ? 'No completed follow-ups yet' :
             'No pending follow-ups'}
          </div>
          <div className="text-[12.5px] text-ink-500">
            {filtersActive
              ? 'Adjust the search or date range to see more.'
              : tab === 'completed'
                ? 'When you log a call after a follow-up was scheduled, it appears here.'
                : 'When you log a call with a "Next action" + due date, it shows up here on the due date.'}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-ink-200/70 rounded-xl overflow-hidden">
          {/* Header row (matches 30 Day Follow-up table) */}
          <div className="grid grid-cols-[1fr_minmax(0,1.4fr)_150px_110px] gap-3 px-5 py-2.5 border-b border-ink-200/70 text-[11px] uppercase tracking-wider text-ink-400 font-semibold">
            <div>Student</div>
            <div>Next action</div>
            <div>Due</div>
            <div className="text-right">Action</div>
          </div>
          {filtered.map((f) => {
            const daysDiff = Math.floor((new Date(f.next_action_due).getTime() - Date.now()) / 86400000);
            const isOverdue = daysDiff < 0;
            let dueLabel = '';
            if (f.is_completed) dueLabel = 'Completed';
            else if (daysDiff < 0) dueLabel = `${Math.abs(daysDiff)}d overdue`;
            else if (daysDiff === 0) dueLabel = 'Due today';
            else dueLabel = `In ${daysDiff}d`;

            return (
              <div
                key={f.id}
                className={cn(
                  'grid grid-cols-[1fr_minmax(0,1.4fr)_150px_110px] gap-3 px-5 py-3 items-center border-b border-ink-100 last:border-0 hover:bg-ink-50/50 transition',
                  f.is_completed && 'opacity-70'
                )}
              >
                {/* Student */}
                <div className="flex items-center gap-3 min-w-0">
                  <StudentAvatar first={f.student_first} last={f.student_last} size={34} />
                  <div className="min-w-0">
                    <div className="font-medium text-[13.5px] truncate flex items-center gap-1.5">
                      {f.student_first} {f.student_last}
                      {f.is_completed && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                          <CheckCircle2 className="w-2.5 h-2.5" /> done
                        </span>
                      )}
                    </div>
                    <div className="text-[11.5px] text-ink-500 truncate">{f.student_mobile ?? f.student_email}</div>
                  </div>
                </div>

                {/* Next action + meta */}
                <div className="min-w-0">
                  <div className="text-[13px] text-ink-700 truncate"><span className="font-medium">→</span> {f.next_action}</div>
                  <div className="text-[11.5px] text-ink-500 truncate">
                    Promised on {fmtDate(f.created_at)}
                    {f.coach_name ? ` · ${f.coach_name}` : ''}
                    {f.outcome ? ` · ${f.outcome.replace(/_/g, ' ')}` : ''}
                    {f.is_completed && f.completed_at ? ` · call logged ${fmtDate(f.completed_at)}` : ''}
                  </div>
                </div>

                {/* Due */}
                <div>
                  <div className={cn(
                    'text-[12px] font-semibold',
                    f.is_completed ? 'text-emerald-700' : isOverdue ? 'text-rose-700' : 'text-amber-700'
                  )}>{dueLabel}</div>
                  <div className="text-[11.5px] text-ink-500 mt-0.5">{shortDate(f.next_action_due)}</div>
                </div>

                {/* Action — link to the student's Calls tab (unchanged behaviour) */}
                <div className="text-right">
                  <Link
                    href={`/students?student=${f.student_id}&tab=calls` as any}
                    className="btn-primary h-8 px-3 rounded-md text-[12px] font-medium inline-flex items-center gap-1.5"
                  >
                    <Phone className="w-3.5 h-3.5" /> Log call
                  </Link>
                </div>
              </div>
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
  tone?: 'risk' | 'warn' | 'good';
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
          tone === 'good' ? 'bg-emerald-100 text-emerald-700' :
          'bg-ink-100 text-ink-700'
        )}>{count}</span>
      )}
    </button>
  );
}
