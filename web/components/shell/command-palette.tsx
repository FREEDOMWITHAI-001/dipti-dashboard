'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, UsersRound, IndianRupee, BellRing, Phone, LineChart, Settings2, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Cmd = { id: string; label: string; hint: string; icon: any; href: string };

const COMMANDS: Cmd[] = [
  { id: 'students',  label: 'Students',         hint: 'View and manage students',     icon: UsersRound,  href: '/students' },
  { id: 'emi',       label: 'EMI Tracker',      hint: 'Payment schedule and overdue', icon: IndianRupee, href: '/emi' },
  { id: 'reminders', label: 'Reminders',        hint: 'GHL reminder workflows',       icon: BellRing,    href: '/reminders' },
  { id: 'calls',     label: 'Call Queue',       hint: 'Outbound calls today',         icon: Phone,       href: '/calls' },
  { id: 'reports',   label: 'Reports',          hint: 'Activity and KPIs',            icon: LineChart,   href: '/reports' },
  { id: 'settings',  label: 'Settings',         hint: 'Account, team, preferences',   icon: Settings2,   href: '/settings' },
  { id: 'ghl',       label: 'GHL Integration',  hint: 'Workflow IDs and sync status', icon: Link2,       href: '/settings/ghl' },
];

const PaletteCtx = createContext<{ open: () => void; close: () => void }>({ open: () => {}, close: () => {} });
export const useCommandPalette = () => useContext(PaletteCtx);

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const open = useCallback(() => { setQuery(''); setActive(0); setIsOpen(true); }, []);
  const close = useCallback(() => setIsOpen(false), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMANDS;
    return COMMANDS.filter(c => c.label.toLowerCase().includes(q) || c.hint.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => { setActive(0); }, [query]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((v) => !v);
        return;
      }
      if (!isOpen) return;
      if (e.key === 'Escape') { setIsOpen(false); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, filtered.length - 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
      if (e.key === 'Enter')     { e.preventDefault(); const cmd = filtered[active]; if (cmd) { setIsOpen(false); router.push(cmd.href as any); } }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, filtered, active, router]);

  return (
    <PaletteCtx.Provider value={{ open, close }}>
      {children}
      {isOpen && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center pt-[18vh] px-4" onMouseDown={close}>
          <div className="absolute inset-0 bg-ink-900/30 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-[560px] bg-white rounded-xl shadow-pop border border-ink-200/70 overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 h-12 border-b border-ink-100">
              <Search className="w-4 h-4 text-ink-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Jump to a page or feature…"
                className="flex-1 outline-none text-[14px] bg-transparent"
              />
              <kbd className="text-[11px] text-ink-400">Esc</kbd>
            </div>
            <div className="max-h-[320px] overflow-auto py-1">
              {filtered.length === 0 ? (
                <div className="px-4 py-8 text-center text-[13px] text-ink-500">No matches</div>
              ) : (
                filtered.map((c, i) => {
                  const Icon = c.icon;
                  return (
                    <button
                      key={c.id}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => { setIsOpen(false); router.push(c.href as any); }}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 h-11 text-left',
                        i === active ? 'bg-ink-100' : 'hover:bg-ink-50'
                      )}
                    >
                      <Icon className="w-4 h-4 text-ink-500" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13.5px] font-medium text-ink-900">{c.label}</div>
                        <div className="text-[11.5px] text-ink-500 truncate">{c.hint}</div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
            <div className="px-4 h-9 border-t border-ink-100 flex items-center gap-3 text-[11px] text-ink-500">
              <span><kbd>↑↓</kbd> navigate</span>
              <span><kbd>↵</kbd> open</span>
              <span className="ml-auto"><kbd>⌘</kbd><kbd>K</kbd> toggle</span>
            </div>
          </div>
        </div>
      )}
    </PaletteCtx.Provider>
  );
}
