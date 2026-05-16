'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Calendar, ChevronDown, X } from 'lucide-react';

const PRESETS = [
  { key: '7d',         label: 'Last 7 days' },
  { key: '30d',        label: 'Last 30 days' },
  { key: '90d',        label: 'Last 90 days' },
  { key: 'mtd',        label: 'This month' },
  { key: 'last-month', label: 'Last month' },
  { key: 'ytd',        label: 'This year' },
];

export function ReportsDateFilter({
  currentPreset, currentFrom, currentTo, label,
}: {
  currentPreset: string;
  currentFrom?: string;
  currentTo?: string;
  label: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [from, setFrom] = useState(currentFrom ?? '');
  const [to, setTo] = useState(currentTo ?? '');

  function pickPreset(presetKey: string) {
    router.push(`/reports?preset=${presetKey}` as any);
    setOpen(false);
    setShowCustom(false);
  }

  function applyCustom() {
    if (!from || !to) return;
    if (from > to) {
      alert('From date must be before To date');
      return;
    }
    router.push(`/reports?from=${from}&to=${to}` as any);
    setOpen(false);
    setShowCustom(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="h-9 px-3.5 rounded-lg border border-ink-200 bg-white hover:bg-ink-50 text-[13px] font-medium text-ink-800 inline-flex items-center gap-2 transition"
      >
        <Calendar className="w-3.5 h-3.5 text-ink-500" />
        <span>{label}</span>
        <ChevronDown className="w-3.5 h-3.5 text-ink-500" />
      </button>

      {open && (
        <>
          {/* Backdrop to close on outside click */}
          <div onClick={() => { setOpen(false); setShowCustom(false); }} className="fixed inset-0 z-40" />

          <div className="absolute right-0 top-full mt-1 z-50 w-[280px] bg-white rounded-xl border border-ink-200 shadow-pop p-1.5">
            {!showCustom ? (
              <>
                {PRESETS.map((p) => {
                  const active = currentPreset === p.key;
                  return (
                    <button
                      key={p.key}
                      onClick={() => pickPreset(p.key)}
                      className={
                        'w-full px-3 py-2 rounded-lg text-[13px] text-left transition flex items-center justify-between ' +
                        (active ? 'bg-accent-50 text-accent-700 font-medium' : 'text-ink-700 hover:bg-ink-50')
                      }
                    >
                      <span>{p.label}</span>
                      {active && <span className="text-[11px]">✓</span>}
                    </button>
                  );
                })}
                <div className="border-t border-ink-100 my-1.5" />
                <button
                  onClick={() => setShowCustom(true)}
                  className={
                    'w-full px-3 py-2 rounded-lg text-[13px] text-left transition flex items-center justify-between ' +
                    (currentPreset === 'custom' ? 'bg-accent-50 text-accent-700 font-medium' : 'text-ink-700 hover:bg-ink-50')
                  }
                >
                  <span>Custom range...</span>
                  {currentPreset === 'custom' && <span className="text-[11px]">✓</span>}
                </button>
              </>
            ) : (
              <div className="p-2 space-y-2.5">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[12px] font-semibold text-ink-700">Custom date range</div>
                  <button onClick={() => setShowCustom(false)} className="w-5 h-5 rounded grid place-items-center hover:bg-ink-100">
                    <X className="w-3 h-3 text-ink-500" />
                  </button>
                </div>
                <label className="block">
                  <div className="text-[11.5px] font-medium text-ink-700 mb-1">From</div>
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg border border-ink-200 text-[13px] focus:outline-none focus:border-accent-500"
                  />
                </label>
                <label className="block">
                  <div className="text-[11.5px] font-medium text-ink-700 mb-1">To</div>
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg border border-ink-200 text-[13px] focus:outline-none focus:border-accent-500"
                  />
                </label>
                <div className="flex gap-1.5 pt-1">
                  <button
                    onClick={() => setShowCustom(false)}
                    className="flex-1 h-9 rounded-lg border border-ink-200 text-[12.5px] font-medium hover:bg-ink-50"
                  >
                    Back
                  </button>
                  <button
                    onClick={applyCustom}
                    disabled={!from || !to}
                    className="flex-1 h-9 rounded-lg bg-ink-900 text-white text-[12.5px] font-medium disabled:opacity-50 hover:bg-ink-800"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}