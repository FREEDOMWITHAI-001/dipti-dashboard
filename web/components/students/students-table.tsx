'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, ChevronLeft, ChevronRight, ChevronDown, Check, Phone, IndianRupee } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { StudentAvatar } from '@/components/ui/avatar';
import { StatusPill } from '@/components/ui/status-pill';
import { fmtDateShort, daysFromNow, studentStatusFromEnd } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { Database } from '@/types/database';

type Row = Database['public']['Tables']['students']['Row'];
type StatusKey = 'active' | 'expiring' | 'expired';
type InitialFilter = 'all' | StatusKey;

const PAGE_SIZE = 10;
const TAG_DISPLAY_LIMIT = 3;

// Grid template — give Last call and Payment more breathing room so they
// don't overlap. Used in both header and body rows; must match.
const GRID_COLS = 'grid-cols-[36px_1.4fr_0.9fr_1fr_0.7fr_0.7fr_0.9fr_0.55fr]';

type EmiStatus = 'overdue' | 'due' | 'paid' | 'none';
// Progress filter uses min/max month and week ranges
type ProgressRange = { monthsMin: number; monthsMax: number; weeksMin: number; weeksMax: number; active: boolean };
const DEFAULT_PROGRESS: ProgressRange = { monthsMin: 0, monthsMax: 6, weeksMin: 0, weeksMax: 24, active: false };

export function StudentsTable({
  initialStudents,
  totalCount,
  initialFilter = 'all',
  lastCallByStudent = {},
  lastPaymentByStudent = {},
  emiStatusByStudent = {},
}: {
  initialStudents: Row[];
  totalCount: number;
  initialFilter?: InitialFilter;
  lastCallByStudent?: Record<string, string>;
  lastPaymentByStudent?: Record<string, { mode: string; date: string }>;
  emiStatusByStudent?: Record<string, EmiStatus>;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [students, setStudents] = useState(initialStudents);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [memberships, setMemberships] = useState<Set<string>>(new Set());
  const [statuses, setStatuses] = useState<Set<StatusKey>>(
    initialFilter !== 'all' ? new Set([initialFilter]) : new Set()
  );
  const [tagSel, setTagSel] = useState<Set<string>>(new Set());
  const [emiFilter, setEmiFilter] = useState<Set<EmiStatus>>(new Set());
  const [progressFilter, setProgressFilter] = useState<ProgressRange>(DEFAULT_PROGRESS);
  const sb = useMemo(() => supabaseBrowser(), []);

  useEffect(() => { setStudents(initialStudents); }, [initialStudents]);

  useEffect(() => {
    setStatuses(initialFilter !== 'all' ? new Set([initialFilter]) : new Set());
  }, [initialFilter]);

  useEffect(() => {
    const ch = sb.channel('students-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, () => {
        router.refresh();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'call_logs' }, () => {
        router.refresh();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'emi_schedule' }, () => {
        router.refresh();
      })
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [sb, router]);

  const allMemberships = useMemo(() =>
    Array.from(new Set(students.map((s) => s.membership).filter(Boolean) as string[])).sort(),
    [students]);
  const allTags = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => s.tags?.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [students]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((s) => {
      if (q) {
        const hit = s.first_name?.toLowerCase().includes(q)
          || s.last_name?.toLowerCase().includes(q)
          || s.email?.toLowerCase().includes(q)
          || s.mobile?.includes(q);
        if (!hit) return false;
      }
      if (memberships.size > 0 && !(s.membership && memberships.has(s.membership))) return false;
      if (statuses.size > 0 && !statuses.has(studentStatusFromEnd(s.end_date) as StatusKey)) return false;
      if (tagSel.size > 0 && !s.tags?.some((t) => tagSel.has(t))) return false;

      // EMI filter
      if (emiFilter.size > 0) {
        const myEmi = emiStatusByStudent[s.id] ?? 'none';
        if (!emiFilter.has(myEmi as EmiStatus)) return false;
      }

      // Progress filter (range of months and/or weeks completed)
      if (progressFilter.active) {
        const monthsDone = [
          (s as any).month_1, (s as any).month_2, (s as any).month_3,
          (s as any).month_4, (s as any).month_5, (s as any).month_6,
        ].filter(Boolean).length;
        const weeksDone = Array.from({ length: 24 }, (_, i) =>
          (s as any)[`week_${i + 1}`]
        ).filter(Boolean).length;

        if (monthsDone < progressFilter.monthsMin || monthsDone > progressFilter.monthsMax) return false;
        if (weeksDone < progressFilter.weeksMin || weeksDone > progressFilter.weeksMax) return false;
      }

      return true;
    });
  }, [students, query, memberships, statuses, tagSel, emiFilter, progressFilter, emiStatusByStudent]);

  useEffect(() => { setPage(1); }, [query, memberships, statuses, tagSel, emiFilter, progressFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function openStudent(id: string) {
    const p = new URLSearchParams(params.toString());
    p.set('student', id);
    router.push(`?${p.toString()}` as any, { scroll: false });
  }

  const filterBanner =
    statuses.size === 1
      ? (statuses.has('active') ? 'Active students'
        : statuses.has('expiring') ? 'Expiring within 30 days'
        : 'Expired students')
      : null;

  function clearFilter() {
    setStatuses(new Set());
    router.push('/students' as any);
  }

  return (
    <div className="bg-white border border-ink-200/70 rounded-xl">
      <div className="px-5 py-3 flex items-center gap-2 border-b border-ink-100 flex-wrap">
        <div className="relative flex-1 max-w-[360px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-ink-400" />
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, mobile…"
            className="h-9 pl-9 pr-3 w-full text-[13px] bg-ink-50/60 hover:bg-white focus:bg-white border border-transparent hover:border-ink-200 focus:border-ink-300 rounded-lg outline-none transition"
          />
        </div>
        <FilterDropdown
          label="Membership"
          options={allMemberships.map((m) => ({ value: m, label: m }))}
          selected={memberships}
          onChange={setMemberships}
        />
        <FilterDropdown
          label="Tags"
          options={allTags.map((t) => ({ value: t, label: t }))}
          selected={tagSel}
          onChange={setTagSel}
        />
        <FilterDropdown<StatusKey>
          label="Validity"
          options={[
            { value: 'active',   label: 'Active',        description: 'Diamond access valid for 30+ days' },
            { value: 'expiring', label: 'Expiring soon', description: 'Expires within next 30 days' },
            { value: 'expired',  label: 'Expired',       description: 'Diamond access already expired' },
          ]}
          selected={statuses}
          onChange={setStatuses}
        />
        <FilterDropdown<EmiStatus>
          label="EMI"
          options={[
            { value: 'paid',    label: 'All paid',     description: 'Every EMI marked paid' },
            { value: 'due',     label: 'Due upcoming', description: 'Unpaid EMI due in next 30 days' },
            { value: 'overdue', label: 'Overdue',      description: 'At least one EMI past due' },
            { value: 'none',    label: 'No EMI plan',  description: 'No EMI schedule set' },
          ]}
          selected={emiFilter}
          onChange={setEmiFilter}
        />
        <ProgressFilterDropdown value={progressFilter} onChange={setProgressFilter} />
        {(emiFilter.size > 0 || progressFilter.active || statuses.size > 0 || memberships.size > 0 || tagSel.size > 0) && (
          <button
            onClick={() => {
              setEmiFilter(new Set());
              setProgressFilter(DEFAULT_PROGRESS);
              setStatuses(new Set());
              setMemberships(new Set());
              setTagSel(new Set());
              router.push('/students' as any);
            }}
            className="text-[11.5px] font-medium text-rose-700 hover:underline"
          >
            Clear all
          </button>
        )}
        <div className="ml-auto text-[12px] text-ink-500">
          Showing <span className="font-medium text-ink-900">{filtered.length}</span> of {totalCount}
        </div>
      </div>

      {filterBanner && (
        <div className="px-5 py-2 bg-accent-50/30 border-b border-ink-100 flex items-center gap-2 text-[12.5px]">
          <span className="text-accent-700 font-medium">Filter:</span>
          <span className="text-ink-700">{filterBanner}</span>
          <button onClick={clearFilter} className="ml-auto text-ink-500 hover:text-ink-800 text-[12px]">
            Clear filter ✕
          </button>
        </div>
      )}

      <div className={cn('grid gap-3 px-6 py-2.5 text-[10.5px] uppercase tracking-wider text-ink-500 font-semibold border-b border-ink-100', GRID_COLS)}>
        <div />
        <div>Student</div>
        <div>Membership</div>
        <div>Tags</div>
        <div>End date</div>
        <div>Last call</div>
        <div>Payment</div>
        <div className="text-right">Status</div>
      </div>

      <div>
        {pageRows.map((s) => {
          const totalTags = s.tags?.length ?? 0;
          const visibleTags = (s.tags ?? []).slice(0, TAG_DISPLAY_LIMIT);
          const overflowCount = Math.max(0, totalTags - TAG_DISPLAY_LIMIT);
          const overflowTagsTitle = (s.tags ?? []).slice(TAG_DISPLAY_LIMIT).join(', ');
          const lastCall = lastCallByStudent[s.id];
          const lastPayment = lastPaymentByStudent[s.id];

          return (
            <button
              key={s.id}
              onClick={() => openStudent(s.id)}
              className={cn('row-clickable w-full text-left grid gap-3 px-6 py-3.5 items-center border-b border-ink-100 last:border-0', GRID_COLS)}
            >
              <StudentAvatar first={s.first_name} last={s.last_name} size={30} />
              <div className="min-w-0 overflow-hidden">
                <div className="font-medium text-[13.5px] truncate">{s.first_name} {s.last_name}</div>
                <div className="text-[11.5px] text-ink-500 truncate">{s.email}</div>
              </div>
              <div className="text-[13px] min-w-0 overflow-hidden">
                <div className="text-ink-900 font-medium truncate">{s.membership ?? '—'}</div>
                <div className="text-[11px] text-ink-500 truncate">{fmtDateShort(s.start_date)} – {fmtDateShort(s.end_date)}</div>
              </div>
              <div className="flex flex-wrap gap-1 items-center min-w-0 overflow-hidden">
                {totalTags === 0 && <span className="text-[11px] text-ink-400">—</span>}
                {visibleTags.map((t) => (
                  <span key={t} className="text-[10.5px] font-medium px-1.5 py-0.5 rounded bg-ink-100 text-ink-700 whitespace-nowrap">{t}</span>
                ))}
                {overflowCount > 0 && (
                  <span
                    className="text-[10px] text-ink-500 px-1 cursor-help whitespace-nowrap"
                    title={overflowTagsTitle}
                  >
                    +{overflowCount}
                  </span>
                )}
              </div>
              <div className="text-[12.5px] min-w-0 overflow-hidden">
                <div className="font-medium truncate">{fmtDateShort(s.end_date)}</div>
                <div className="text-[10.5px] text-ink-500 truncate">{
                  (() => {
                    const d = daysFromNow(s.end_date);
                    if (d === null) return '—';
                    if (d < 0) return 'expired';
                    return `in ${d}d`;
                  })()
                }</div>
              </div>
              <div className="text-[12px] min-w-0 overflow-hidden">
                {lastCall ? (
                  <div className="flex items-center gap-1 text-ink-700 min-w-0">
                    <Phone className="w-3 h-3 text-ink-400 flex-shrink-0" />
                    <span className="truncate">{lastCall}</span>
                  </div>
                ) : (
                  <span className="text-ink-400">—</span>
                )}
              </div>
              <div className="text-[12px] min-w-0 overflow-hidden">
                {lastPayment ? (
                  <div className="flex items-center gap-1 text-ink-700 min-w-0">
                    <IndianRupee className="w-3 h-3 text-ink-400 flex-shrink-0" />
                    <span className="truncate">{lastPayment.mode} · {lastPayment.date}</span>
                  </div>
                ) : (
                  <span className="text-ink-400">—</span>
                )}
              </div>
              <div className="flex items-center justify-end min-w-0">
                <StatusPill status={studentStatusFromEnd(s.end_date)} />
              </div>
            </button>
          );
        })}
        {pageRows.length === 0 && (
          <div className="px-6 py-12 text-center text-[13px] text-ink-500">
            {filtered.length === 0 ? 'No students match your filters.' : 'No students on this page.'}
          </div>
        )}
      </div>

      <div className="px-6 py-3 flex items-center justify-between text-[12px] text-ink-500 border-t border-ink-100">
        <div>Page {safePage} of {pageCount}</div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className="h-7 w-7 rounded-md border border-ink-200 grid place-items-center hover:bg-ink-50 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Previous page"
          ><ChevronLeft className="w-3.5 h-3.5" /></button>
          {pageNumbers(safePage, pageCount).map((n, i) => (
            n === '…' ? (
              <span key={`gap-${i}`} className="px-1 text-ink-400">…</span>
            ) : (
              <button
                key={n}
                onClick={() => setPage(n as number)}
                className={cn(
                  'h-7 min-w-7 px-2 rounded-md border border-ink-200 grid place-items-center hover:bg-ink-50',
                  n === safePage && 'bg-ink-100 font-medium text-ink-900'
                )}
              >{n}</button>
            )
          ))}
          <button
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            disabled={safePage === pageCount}
            className="h-7 w-7 rounded-md border border-ink-200 grid place-items-center hover:bg-ink-50 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Next page"
          ><ChevronRight className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    </div>
  );
}

function pageNumbers(current: number, total: number): Array<number | '…'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: Array<number | '…'> = [1];
  if (current > 3) out.push('…');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) out.push(i);
  if (current < total - 2) out.push('…');
  out.push(total);
  return out;
}

function FilterDropdown<T extends string = string>({
  label, options, selected, onChange,
}: {
  label: string;
  options: Array<{ value: T; label: string; description?: string }>;
  selected: Set<T>;
  onChange: (next: Set<T>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  function toggle(v: T) {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange(next);
  }

  function clear() { onChange(new Set()); }

  const count = selected.size;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'h-9 px-3 rounded-lg border text-[12.5px] font-medium flex items-center gap-1.5 hover:bg-ink-50',
          count > 0 ? 'border-accent-500 text-accent-700 bg-accent-50' : 'border-ink-200 text-ink-700'
        )}
      >
        {label}
        {count > 0 && <span className="text-[11px] bg-accent-100 text-accent-700 rounded px-1.5">{count}</span>}
        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] w-[220px] bg-white border border-ink-200/80 shadow-pop rounded-lg overflow-hidden z-30">
          <div className="max-h-[260px] overflow-auto py-1">
            {options.length === 0 ? (
              <div className="px-3 py-3 text-[12px] text-ink-500 text-center">No options</div>
            ) : (
              options.map((o) => {
                const active = selected.has(o.value);
                return (
                  <button
                    key={o.value}
                    onClick={() => toggle(o.value)}
                    title={o.description}
                    className="w-full flex items-start gap-2 px-3 py-2 text-[13px] text-left hover:bg-ink-50"
                  >
                    <span className={cn('w-4 h-4 rounded border grid place-items-center mt-0.5 shrink-0', active ? 'bg-accent-600 border-accent-600 text-white' : 'border-ink-300')}>
                      {active && <Check className="w-3 h-3" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{o.label}</div>
                      {o.description && (
                        <div className="text-[10.5px] text-ink-500 mt-0.5 leading-snug">{o.description}</div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
          {count > 0 && (
            <button onClick={clear} className="w-full text-center py-2 text-[12px] text-ink-600 hover:bg-ink-50 border-t border-ink-100">
              Clear ({count})
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ProgressFilterDropdown({ value, onChange }: { value: ProgressRange; onChange: (v: ProgressRange) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<ProgressRange>(value);

  useEffect(() => { setDraft(value); }, [value]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  function apply() {
    onChange({ ...draft, active: true });
    setOpen(false);
  }

  function clear() {
    onChange(DEFAULT_PROGRESS);
    setDraft(DEFAULT_PROGRESS);
    setOpen(false);
  }

  const summary = value.active
    ? `${value.monthsMin}-${value.monthsMax}M · ${value.weeksMin}-${value.weeksMax}W`
    : '';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'h-9 px-3 rounded-lg border text-[12.5px] font-medium flex items-center gap-1.5 hover:bg-ink-50',
          value.active ? 'border-accent-500 text-accent-700 bg-accent-50' : 'border-ink-200 text-ink-700'
        )}
      >
        Progress
        {value.active && <span className="text-[10.5px] bg-accent-100 text-accent-700 rounded px-1.5 font-mono">{summary}</span>}
        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] w-[300px] bg-white border border-ink-200/80 shadow-pop rounded-lg overflow-hidden z-30 p-4">
          <div className="text-[12px] font-semibold text-ink-700 mb-3">Filter by completion range</div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11.5px] font-medium text-ink-700">Months completed</label>
              <span className="text-[11px] font-mono text-ink-500">{draft.monthsMin} - {draft.monthsMax}</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number" min={0} max={6} value={draft.monthsMin}
                onChange={(e) => setDraft({ ...draft, monthsMin: Math.max(0, Math.min(6, Number(e.target.value) || 0)) })}
                className="w-14 h-8 px-2 rounded border border-ink-200 text-[12.5px] text-center"
              />
              <span className="text-ink-400 text-[12px]">to</span>
              <input
                type="number" min={0} max={6} value={draft.monthsMax}
                onChange={(e) => setDraft({ ...draft, monthsMax: Math.max(0, Math.min(6, Number(e.target.value) || 0)) })}
                className="w-14 h-8 px-2 rounded border border-ink-200 text-[12.5px] text-center"
              />
              <span className="text-[11px] text-ink-500">of 6</span>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11.5px] font-medium text-ink-700">Weeks completed</label>
              <span className="text-[11px] font-mono text-ink-500">{draft.weeksMin} - {draft.weeksMax}</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number" min={0} max={24} value={draft.weeksMin}
                onChange={(e) => setDraft({ ...draft, weeksMin: Math.max(0, Math.min(24, Number(e.target.value) || 0)) })}
                className="w-14 h-8 px-2 rounded border border-ink-200 text-[12.5px] text-center"
              />
              <span className="text-ink-400 text-[12px]">to</span>
              <input
                type="number" min={0} max={24} value={draft.weeksMax}
                onChange={(e) => setDraft({ ...draft, weeksMax: Math.max(0, Math.min(24, Number(e.target.value) || 0)) })}
                className="w-14 h-8 px-2 rounded border border-ink-200 text-[12.5px] text-center"
              />
              <span className="text-[11px] text-ink-500">of 24</span>
            </div>
          </div>

          <div className="text-[10.5px] text-ink-500 mb-3 leading-relaxed bg-ink-50/70 px-2.5 py-1.5 rounded">
            Show students who have completed between the entered range of months AND weeks.
          </div>

          {/* Quick presets */}
          <div className="mb-3">
            <div className="text-[10.5px] uppercase tracking-wider font-semibold text-ink-500 mb-1.5">Quick</div>
            <div className="flex flex-wrap gap-1">
              <PresetBtn label="All completed" onClick={() => setDraft({ ...draft, monthsMin: 6, monthsMax: 6, weeksMin: 24, weeksMax: 24 })} />
              <PresetBtn label="Half done (3M)" onClick={() => setDraft({ ...draft, monthsMin: 3, monthsMax: 3, weeksMin: 0, weeksMax: 24 })} />
              <PresetBtn label="Just started (0-1M)" onClick={() => setDraft({ ...draft, monthsMin: 0, monthsMax: 1, weeksMin: 0, weeksMax: 24 })} />
              <PresetBtn label="Pending" onClick={() => setDraft({ ...draft, monthsMin: 0, monthsMax: 5, weeksMin: 0, weeksMax: 23 })} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={clear} className="flex-1 h-8 rounded-md border border-ink-200 text-[12px] font-medium hover:bg-ink-50">
              Clear
            </button>
            <button onClick={apply} className="flex-1 h-8 rounded-md bg-ink-900 text-white text-[12px] font-medium hover:bg-ink-800">
              Apply filter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PresetBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-[11px] px-2 py-1 rounded border border-ink-200 hover:bg-accent-50 hover:border-accent-300 hover:text-accent-700 transition">
      {label}
    </button>
  );
}