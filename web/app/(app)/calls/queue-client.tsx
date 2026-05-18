'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Phone, CalendarClock, MessageSquare } from 'lucide-react';
import { StudentAvatar } from '@/components/ui/avatar';
import { fmtDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/shell/toast-region';

type QueueItem = {
  id: string;
  student_id: string;
  first_name: string | null;
  last_name: string | null;
  mobile: string | null;
  email: string | null;
  next_action: string | null;
  next_action_due: string | null;
  days_overdue: number;
  coach_name: string | null;
  type: 'followup' | 'silent';
};

type Tab = 'all' | 'followup' | 'silent';

export function CallQueueClient({
  items, followupCount, silentCount,
}: {
  items: QueueItem[];
  followupCount: number;
  silentCount: number;
}) {
  const [tab, setTab] = useState<Tab>('all');

  const filtered = useMemo(() => {
    if (tab === 'all') return items;
    return items.filter((i) => i.type === tab);
  }, [items, tab]);

  if (items.length === 0) {
    return (
      <div className="bg-white border border-ink-200/70 rounded-xl p-12 text-center">
        <div className="text-3xl mb-2">🎉</div>
        <div className="text-[14.5px] font-medium text-ink-800 mb-1">No outstanding calls</div>
        <div className="text-[12.5px] text-ink-500">No follow-ups due and no silent students. Queue is clear.</div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white border border-ink-200/70 rounded-xl mb-5 p-1.5 flex items-center gap-1 w-fit">
        <TabBtn active={tab === 'all'}      onClick={() => setTab('all')}      label="All"        count={items.length} />
        <TabBtn active={tab === 'followup'} onClick={() => setTab('followup')} label="Follow-ups" count={followupCount} tone="risk" />
        <TabBtn active={tab === 'silent'}   onClick={() => setTab('silent')}   label="Silent 30d" count={silentCount}   tone="warn" />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-ink-200/70 rounded-xl p-10 text-center text-[13px] text-ink-500">
          No {tab === 'followup' ? 'follow-ups' : 'silent students'} in this section.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((it) => <ItemCard key={`${it.type}-${it.id}`} item={it} />)}
        </div>
      )}
    </>
  );
}

function ItemCard({ item }: { item: QueueItem }) {
  const { toast } = useToast();
  const isFollowup = item.type === 'followup';

  function callNow(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (item.mobile) {
      window.location.href = `tel:${item.mobile.replace(/\s+/g, '')}`;
    } else {
      toast('No mobile number on file', 'info');
    }
  }

  return (
    <Link
      href={`/students?student=${item.student_id}&tab=calls` as any}
      className={cn(
        'block rounded-xl border p-4 transition hover:shadow-md',
        isFollowup
          ? 'bg-rose-50/30 border-rose-200/70 hover:bg-rose-50/50'
          : 'bg-white border-ink-200/70 hover:bg-ink-50/40'
      )}
    >
      <div className="flex items-start gap-3 mb-2.5">
        <StudentAvatar first={item.first_name} last={item.last_name} size={40} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="font-semibold text-[14px] text-ink-900 truncate">
              {item.first_name} {item.last_name}
            </div>
            {isFollowup ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">
                <CalendarClock className="w-2.5 h-2.5" />
                Follow-up
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                Silent 30d
              </span>
            )}
          </div>
          <div className="text-[11.5px] text-ink-500 mt-0.5 truncate">
            {item.mobile ?? item.email ?? 'No contact info'}
          </div>
        </div>
      </div>

      {isFollowup && item.next_action && (
        <div className="text-[12.5px] text-ink-700 mb-2 flex items-start gap-1.5">
          <MessageSquare className="w-3 h-3 mt-1 text-rose-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="line-clamp-2">{item.next_action}</div>
            <div className="text-[11px] text-rose-700 font-medium mt-0.5">
              {item.days_overdue > 0
                ? `${item.days_overdue} day${item.days_overdue === 1 ? '' : 's'} overdue`
                : 'Due today'}
              {item.next_action_due ? ` · ${fmtDate(item.next_action_due)}` : ''}
              {item.coach_name ? ` · ${item.coach_name}` : ''}
            </div>
          </div>
        </div>
      )}

      {!isFollowup && (
        <div className="text-[12px] text-ink-500 mb-2">
          No call logged in 30+ days
        </div>
      )}

      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={callNow}
          className="flex-1 h-8 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-medium inline-flex items-center justify-center gap-1.5"
        >
          <Phone className="w-3 h-3" />
          Call now
        </button>
      </div>
    </Link>
  );
}

function TabBtn({ active, onClick, label, count, tone }: {
  active: boolean; onClick: () => void; label: string; count: number; tone?: 'risk' | 'warn';
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