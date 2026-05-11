'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { CheckCircle, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Toast = { id: number; message: string; type: 'success' | 'error' | 'info' };

const ToastCtx = createContext<{ toast: (m: string, type?: Toast['type']) => void }>({
  toast: () => {},
});

export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, message, type }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 3500);
  }, []);

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-2 items-end pointer-events-none">
        {items.map((t) => <ToastItem key={t.id} {...t} />)}
      </div>
    </ToastCtx.Provider>
  );
}

function ToastItem({ message, type }: Toast) {
  const [show, setShow] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setShow(true)); }, []);
  const Icon = type === 'success' ? CheckCircle : type === 'error' ? XCircle : Info;
  const cls = type === 'success'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
    : type === 'error'
    ? 'border-rose-200 bg-rose-50 text-rose-900'
    : 'border-ink-200 bg-white';
  return (
    <div className={cn(
      'pointer-events-auto border shadow-pop rounded-xl px-4 py-3 flex items-center gap-3 text-[13px] font-medium transition',
      cls,
      show ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
    )}>
      <Icon className="w-4 h-4" />
      <span>{message}</span>
    </div>
  );
}
