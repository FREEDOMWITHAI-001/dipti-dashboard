'use client';
 
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, ArrowRight, MessageSquare } from 'lucide-react';
import { CoachAvatar } from '@/components/ui/avatar';
import { fmtDate, cn } from '@/lib/utils';
 
type Row = {
  id: string;
  comment: string;
  outcome: 'connected' | 'no_answer' | 'rescheduled' | 'wrong_number' | null;
  next_action: string | null;
  next_action_due: string | null;
  created_at: string;
  student: { id: string; first_name: string | null; last_name: string | null; email: string };
  coach: { id: string; display_name: string; initials: string } | null;
};
 
const OUTCOMES = ['', 'connected', 'no_answer', 'rescheduled', 'wrong_number'] as const;
type Outcome = typeof OUTCOMES[number];
 
export function CommentsFeed({ initial }: { initial: Row[] }) {
  const [query, setQuery] = useState('');
  const [outcome, setOutcome] = useState<Outcome>('');
  const [coachId, setCoachId] = useState<string>('');
 
  // Unique coaches present in the data, for the filter dropdown.
  const coaches = useMemo(() => {
    const map = new Map<string, string>();
    initial.forEach((r) => {
      if (r.coach) map.set(r.coach.id, r.coach.display_name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [initial]);
 
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return initial.filter((r) => {
      if (outcome && r.outcome !== outcome) return false;
      if (coachId && r.coach?.id !== coachId) return false;
      if (!q) return true;
      const name = `${r.student.first_name ?? ''} ${r.student.last_name ?? ''}`.toLowerCase();
      return (
        r.comment.toLowerCase().includes(q) ||
        name.includes(q) ||
        r.student.email.toLowerCase().includes(q) ||
        (r.next_action ?? '').toLowerCase().includes(q)
      );
    });
  }, [initial, query, outcome, coachId]);
 
  return (
    <div>
      {/* Filters */}
      <div className="bg-white border border-ink-200/70 rounded-xl p-3 mb-4 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search comments, student name, email…"
            className="w-full h-9 pl-9 pr-3 rounded-md border border-ink-200 focus:border-accent-500 focus:ring-2 focus:ring-accent-100 outline-none text-[13px] bg-white"
          />
        </div>
        <select
          value={outcome}
          onChange={(e) => setOutcome(e.target.value as Outcome)}
          className="h-9 px-2.5 rounded-md border border-ink-200 text-[12.5px] font-medium bg-white"
        >
          <option value="">All outcomes</option>
          <option value="connected">Connected</option>
          <option value="no_answer">No answer</option>
          <option value="rescheduled">Rescheduled</option>
          <option value="wrong_number">Wrong number</option>
        </select>
        <select
          value={coachId}
          onChange={(e) => setCoachId(e.target.value)}
          className="h-9 px-2.5 rounded-md border border-ink-200 text-[12.5px] font-medium bg-white max-w-[180px]"
        >
          <option value="">All coaches</option>
          {coaches.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <div className="text-[12px] text-ink-500 ml-auto">
          {filtered.length} of {initial.length}
        </div>
      </div>
 
      {/* Feed */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-ink-200/70 rounded-xl p-10 text-center">
          <MessageSquare className="w-8 h-8 text-ink-300 mx-auto mb-2" />
          <div className="text-[14px] font-medium text-ink-700">No comments match these filters</div>
          <div className="text-[12.5px] text-ink-500 mt-1">
            {initial.length === 0
              ? 'No calls have been logged yet.'
              : 'Try clearing the search or filters above.'}
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((r) => {
            const name = `${r.student.first_name ?? ''} ${r.student.last_name ?? ''}`.trim() || r.student.email;
            return (
              <div key={r.id} className="bg-white border border-ink-200/70 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CoachAvatar initials={r.coach?.initials ?? '?'} size={24} />
                  <div className="text-[13px] font-medium">{r.coach?.display_name ?? 'Unknown'}</div>
                  <span className="text-ink-300">·</span>
                  <Link
                    href={`/comments?student=${r.student.id}` as any}
                    scroll={false}
                    className="text-[13px] font-medium text-accent-700 hover:underline underline-offset-2"
                  >
                    {name}
                  </Link>
                  <div className="text-[11.5px] text-ink-500 ml-1">{fmtDate(r.created_at)}</div>
                  {r.outcome && (
                    <span className={cn(
                      'ml-auto text-[10.5px] font-medium px-2 py-0.5 rounded-full ring-1 ring-inset',
                      r.outcome === 'connected' ? 'bg-emerald-50 text-emerald-700 ring-emerald-100' :
                      r.outcome === 'no_answer' ? 'bg-rose-50 text-rose-700 ring-rose-100' :
                      'bg-ink-100 text-ink-600 ring-ink-200'
                    )}>
                      {r.outcome.replace('_', ' ')}
                    </span>
                  )}
                </div>
                <div className="text-[13px] leading-relaxed text-ink-800 whitespace-pre-wrap">{r.comment}</div>
                {r.next_action && (
                  <div className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] font-medium text-ink-700 bg-ink-50 px-2 py-1 rounded-md">
                    <ArrowRight className="w-3 h-3" />
                    {r.next_action}
                    {r.next_action_due && (
                      <span className="text-ink-500 font-normal">· due {r.next_action_due}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}