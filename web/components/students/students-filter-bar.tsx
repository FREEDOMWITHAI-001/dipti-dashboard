'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Filter, X, IndianRupee, Calendar, CheckCircle2, FileText, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

type FilterDef = {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  options: { value: string; label: string; tone?: 'good' | 'warn' | 'risk' }[];
};

const FILTERS: FilterDef[] = [
  {
    key: 'emi',
    label: 'EMI Status',
    icon: IndianRupee,
    options: [
      { value: 'all',      label: 'All' },
      { value: 'paid',     label: 'Fully Paid',   tone: 'good' },
      { value: 'due',      label: 'Has Due',      tone: 'warn' },
      { value: 'overdue',  label: 'Has Overdue',  tone: 'risk' },
    ],
  },
  {
    key: 'validity',
    label: 'Validity',
    icon: Calendar,
    options: [
      { value: 'all',       label: 'All' },
      { value: 'active',    label: 'Active',     tone: 'good' },
      { value: 'expiring',  label: 'Expiring 30d', tone: 'warn' },
      { value: 'expired',   label: 'Expired',    tone: 'risk' },
    ],
  },
  {
    key: 'progress',
    label: 'Progress',
    icon: CheckCircle2,
    options: [
      { value: 'all',        label: 'All' },
      { value: 'completed',  label: 'Completed 6/6', tone: 'good' },
      { value: 'in_progress', label: 'In progress',  tone: 'warn' },
      { value: 'not_started', label: 'Not started',  tone: 'risk' },
    ],
  },
  {
    key: 'certificate',
    label: 'Certificate',
    icon: FileText,
    options: [
      { value: 'all',      label: 'All' },
      { value: 'issued',   label: 'Issued',  tone: 'good' },
      { value: 'pending',  label: 'Pending', tone: 'warn' },
    ],
  },
];

export function StudentsFilterBar() {
  const router = useRouter();
  const params = useSearchParams();
  
  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params?.toString() ?? '');
    if (value === 'all') {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    router.push(`/students${next.toString() ? '?' + next.toString() : ''}` as any);
  };

  const clearAll = () => {
    router.push('/students' as any);
  };

  // Count active filters (excluding "all")
  const activeFilters = FILTERS.filter(f => {
    const v = params?.get(f.key);
    return v && v !== 'all';
  });
  const hasFilters = activeFilters.length > 0;

  return (
    <div className="flex items-center gap-2 mb-4 flex-wrap">
      <div className="flex items-center gap-1.5 text-[12px] text-ink-500 font-medium px-1">
        <Filter className="w-3.5 h-3.5" />
        Filters:
      </div>
      
      {FILTERS.map(filter => (
        <FilterDropdown 
          key={filter.key}
          filter={filter}
          currentValue={params?.get(filter.key) ?? 'all'}
          onSelect={(v) => setFilter(filter.key, v)}
        />
      ))}
      
      {hasFilters && (
        <button
          onClick={clearAll}
          className="ml-auto flex items-center gap-1 text-[11.5px] text-ink-600 hover:text-ink-900 font-medium px-2 py-1 rounded hover:bg-ink-100"
        >
          <X className="w-3 h-3" />
          Clear all
        </button>
      )}
    </div>
  );
}

function FilterDropdown({ 
  filter, 
  currentValue, 
  onSelect 
}: { 
  filter: FilterDef; 
  currentValue: string; 
  onSelect: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const Icon = filter.icon;
  const current = filter.options.find(o => o.value === currentValue) ?? filter.options[0];
  const isActive = currentValue !== 'all';

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toneClass = (tone?: 'good' | 'warn' | 'risk') => {
    if (tone === 'good') return 'bg-emerald-50 border-emerald-200 text-emerald-800';
    if (tone === 'warn') return 'bg-amber-50 border-amber-200 text-amber-800';
    if (tone === 'risk') return 'bg-rose-50 border-rose-200 text-rose-800';
    return 'bg-white border-ink-200 text-ink-700';
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[12px] font-medium transition',
          isActive ? toneClass(current.tone) : 'bg-white border-ink-200 text-ink-700 hover:bg-ink-50'
        )}
      >
        <Icon className="w-3.5 h-3.5" />
        <span>{filter.label}:</span>
        <span className={isActive ? 'font-semibold' : ''}>{current.label}</span>
        <ChevronDown className={cn('w-3 h-3 transition', open && 'rotate-180')} />
      </button>
      
      {open && (
        <div className="absolute top-full left-0 mt-1 z-10 bg-white border border-ink-200 rounded-lg shadow-lg overflow-hidden min-w-[160px]">
          {filter.options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onSelect(opt.value); setOpen(false); }}
              className={cn(
                'w-full text-left px-3 py-2 text-[12.5px] hover:bg-ink-50 flex items-center justify-between',
                currentValue === opt.value && 'bg-ink-50 font-medium'
              )}
            >
              <span>{opt.label}</span>
              {currentValue === opt.value && <span className="text-blue-600">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}