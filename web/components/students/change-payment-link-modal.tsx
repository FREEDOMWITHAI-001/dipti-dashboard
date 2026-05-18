'use client';

import { useState } from 'react';
import { X, Link as LinkIcon, Loader2, Trash2 } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useToast } from '@/components/shell/toast-region';
import { Button } from '@/components/ui/button';

export function ChangePaymentLinkModal({
  open, onClose, onSaved, studentId, currentLink,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  studentId: string;
  currentLink: string | null;
}) {
  const sb = supabaseBrowser();
  const { toast } = useToast();
  const [link, setLink] = useState(currentLink ?? '');
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function save() {
    const trimmed = link.trim();
    if (trimmed && !/^https?:\/\//i.test(trimmed)) {
      toast('Payment link must start with http:// or https://', 'error');
      return;
    }
    setBusy(true);
    const { error } = await sb.from('students').update({ payment_link: trimmed || null } as any).eq('id', studentId);
    setBusy(false);
    if (error) { toast(error.message, 'error'); return; }
    toast(trimmed ? 'Payment link updated. Will be used for all upcoming EMIs.' : 'Payment link removed.', 'success');
    onSaved();
    onClose();
  }

  async function remove() {
    setBusy(true);
    const { error } = await sb.from('students').update({ payment_link: null } as any).eq('id', studentId);
    setBusy(false);
    if (error) { toast(error.message, 'error'); return; }
    toast('Payment link removed.', 'success');
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center pt-[12vh] px-4" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-[480px] bg-white rounded-2xl shadow-pop border border-ink-200/70 overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 h-14 border-b border-ink-100">
          <div className="flex items-center gap-2">
            <LinkIcon className="w-4 h-4 text-accent-600" />
            <div className="font-semibold text-[15px]">
              {currentLink ? 'Change payment link' : 'Add payment link'}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-md hover:bg-ink-100 grid place-items-center" aria-label="Close">
            <X className="w-4 h-4 text-ink-500" />
          </button>
        </div>

        <div className="p-5">
          <label className="block">
            <div className="text-[12.5px] font-medium text-ink-700 mb-2">Payment URL</div>
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://rzp.io/i/abc123"
              autoFocus
              className="w-full h-10 px-3 rounded-lg border border-ink-200 focus:border-accent-500 focus:ring-2 focus:ring-accent-100 outline-none text-[13.5px] bg-white"
            />
            <div className="text-[11.5px] text-ink-500 mt-2 leading-relaxed">
              This link will be sent to the student in every EMI reminder.
              {!currentLink && ' Once set, it applies automatically to all upcoming EMIs by default.'}
              {currentLink && ' Updating this changes the link used for all FUTURE reminders. Past reminder messages stay unchanged.'}
            </div>
          </label>

          <div className="mt-4 p-3 bg-ink-50/70 rounded-lg text-[11.5px] text-ink-600 leading-relaxed">
            <div className="font-medium text-ink-800 mb-0.5">Supported providers</div>
            Razorpay, Stripe, GHL payment links, PayU, Cashfree, or any payment URL.
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-ink-100">
          {currentLink ? (
            <button
              onClick={remove}
              disabled={busy}
              className="text-[12.5px] font-medium text-rose-700 hover:text-rose-900 disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <Trash2 className="w-3 h-3" />
              Remove link
            </button>
          ) : <div />}
          <div className="flex items-center gap-2">
            <Button type="button" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button variant="primary" onClick={save} disabled={busy}>
              {busy ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : (currentLink ? 'Update link' : 'Save link')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}