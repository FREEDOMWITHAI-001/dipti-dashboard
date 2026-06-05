'use client';

import { useState } from 'react';
import { X, Calendar, Loader2 } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useToast } from '@/components/shell/toast-region';
import { Button } from '@/components/ui/button';

// Change the due date of ONE installment, without touching its amount, the plan,
// or any other EMI. The reminder date moves with it (fires 2 days before, the
// same rule the rest of the app uses).
function reminderFor(d: string): string {
  const [y, m, dd] = d.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, dd));
  date.setUTCDate(date.getUTCDate() - 2);
  return date.toISOString().slice(0, 10);
}

export function EditDueDateModal({
  open, onClose, onSaved, emiId, installmentLabel, initialDueDate,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  emiId: string;
  installmentLabel: string;
  initialDueDate: string;
}) {
  const sb = supabaseBrowser();
  const { toast } = useToast();
  const [dueDate, setDueDate] = useState(initialDueDate);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function save() {
    if (!dueDate) { toast('Pick a due date.', 'error'); return; }
    setBusy(true);
    const { error } = await sb
      .from('emi_schedule')
      .update({ due_date: dueDate, reminder_date: reminderFor(dueDate) } as any)
      .eq('id', emiId);
    setBusy(false);
    if (error) { toast(error.message, 'error'); return; }
    toast(`Due date for installment ${installmentLabel} updated.`, 'success');
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center pt-[8vh] px-4" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-[420px] bg-white rounded-2xl shadow-pop border border-ink-200/70 overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 h-14 border-b border-ink-100">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-accent-600" />
            <div className="font-semibold text-[15px]">Change due date · {installmentLabel}</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-md hover:bg-ink-100 grid place-items-center" aria-label="Close">
            <X className="w-4 h-4 text-ink-500" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <label className="block">
            <div className="text-[11.5px] font-medium text-ink-700 mb-1">Due date</div>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-ink-200 text-[13px] focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-100 bg-white"
              autoFocus
            />
          </label>
          <div className="text-[11.5px] text-ink-500">
            Only this installment changes — the amount and the rest of the plan stay the same. The reminder moves to 2 days before.
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-ink-100">
          <Button type="button" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={busy}>
            {busy
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
              : <><Calendar className="w-3.5 h-3.5" /> Save date</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
