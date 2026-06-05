'use client';

import { useState } from 'react';
import { X, Link as LinkIcon, Loader2, CheckCircle2, Copy, ExternalLink, AlertTriangle } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useToast } from '@/components/shell/toast-region';
import { Button } from '@/components/ui/button';
import { fmtINR } from '@/lib/utils';

// Edit an unpaid EMI's amount RIGHT BEFORE generating its payment link.
//
// The coach can raise or lower this installment's amount. The plan TOTAL must
// stay the same, so the difference is removed from / added to the remaining
// unpaid installments — but ONLY once this EMI is actually PAID. The even
// split across the remaining rows is performed by the `emi_redistribute_on_paid`
// DB trigger; here we just (a) store the pre-edit plan amount in
// `original_amount`, (b) set the new amount, and (c) generate the link. The
// preview below mirrors exactly what the trigger will do on payment.

type RemainingEmi = { id: string; label: string; amount: number };

// Round half away from zero — matches Postgres numeric round() so the preview
// numbers equal what the trigger writes.
const rnd = (x: number) => Math.sign(x) * Math.round(Math.abs(x));

// Spread `-delta` across the remaining EMIs: each but the last takes
// round(delta / n); the last absorbs the remainder so totals reconcile exactly.
function previewRedistribution(delta: number, remaining: RemainingEmi[]) {
  const n = remaining.length;
  let distributed = 0;
  return remaining.map((e, i) => {
    const share = i < n - 1 ? rnd(delta / n) : delta - distributed;
    distributed += share;
    const newAmount = Math.max(e.amount - share, 0);
    return { ...e, newAmount, change: newAmount - e.amount };
  });
}

export function EditEmiLinkModal({
  open, onClose, onSaved,
  emiId, installmentLabel, currentAmount, existingOriginal, remainingEmis,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  emiId: string;
  installmentLabel: string;
  currentAmount: number;
  existingOriginal: number | null;
  remainingEmis: RemainingEmi[];
}) {
  const sb = supabaseBrowser();
  const { toast } = useToast();

  // The plan amount the redistribution is measured against. If this EMI was
  // already edited once, keep that first plan amount; otherwise the current
  // amount IS the plan amount.
  const planAmount = existingOriginal ?? currentAmount;

  const [amount, setAmount] = useState<number>(Math.max(0, Math.round(currentAmount)));
  const [busy, setBusy] = useState(false);
  const [createdLink, setCreatedLink] = useState<string | null>(null);

  if (!open) return null;

  const delta = amount - planAmount;
  const isLast = remainingEmis.length === 0;
  const preview = delta !== 0 && !isLast ? previewRedistribution(delta, remainingEmis) : [];

  function copy(text: string) {
    navigator.clipboard.writeText(text)
      .then(() => toast('Link copied to clipboard', 'success'))
      .catch(() => toast('Failed to copy', 'error'));
  }

  async function submit() {
    if (busy) return;
    if (!(amount > 0)) { toast('Enter an amount greater than 0.', 'error'); return; }
    setBusy(true);

    // Save the new amount + remember the plan amount for the trigger to use when
    // this EMI is paid. Re-saving keeps the FIRST plan amount (existingOriginal).
    const { error } = await sb
      .from('emi_schedule')
      .update({ amount, original_amount: planAmount } as any)
      .eq('id', emiId);
    if (error) { setBusy(false); toast(error.message, 'error'); return; }

    // Generate the Cashfree link for the (possibly new) amount.
    try {
      const res = await fetch('/api/cashfree/generate-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emiId }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? 'Failed to generate link');
      setBusy(false);
      onSaved();
      setCreatedLink(data.link_url ?? '');
      toast(`Payment link for ${fmtINR(amount)} created.`, 'success');
    } catch (e: any) {
      // Amount was saved; only the link failed. Refresh so the row reflects the
      // new amount, and let the coach retry "Get link" on it.
      setBusy(false);
      toast(`Amount saved, but link failed: ${e.message}`, 'error');
      onSaved();
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center pt-[8vh] px-4" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-[480px] bg-white rounded-2xl shadow-pop border border-ink-200/70 overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 h-14 border-b border-ink-100">
          <div className="flex items-center gap-2">
            <LinkIcon className="w-4 h-4 text-accent-600" />
            <div className="font-semibold text-[15px]">Get payment link · {installmentLabel}</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-md hover:bg-ink-100 grid place-items-center" aria-label="Close">
            <X className="w-4 h-4 text-ink-500" />
          </button>
        </div>

        {createdLink ? (
          // ---- Link ready: copy / open / send ----
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-emerald-700 font-semibold text-[13.5px]">
              <CheckCircle2 className="w-4 h-4" /> Payment link ready
            </div>
            <div className="text-[12px] text-ink-600">
              Share this link with the student to collect {fmtINR(amount)}. They&apos;ll pay on Cashfree and the installment is marked paid automatically.
              {delta !== 0 && !isLast && (
                <> The remaining installments will rebalance once this payment is completed.</>
              )}
            </div>
            <div className="flex items-center gap-2 bg-ink-50 border border-ink-200 rounded-lg px-3 py-2">
              <input readOnly value={createdLink} className="flex-1 bg-transparent text-[12px] text-ink-700 outline-none truncate" />
              <button onClick={() => copy(createdLink)} className="text-ink-600 hover:text-ink-900" title="Copy link"><Copy className="w-4 h-4" /></button>
              <a href={createdLink} target="_blank" rel="noopener noreferrer" className="text-accent-700 hover:text-accent-900" title="Open link"><ExternalLink className="w-4 h-4" /></a>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button variant="primary" onClick={onClose}>Done</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="p-5 space-y-3">
              <Field label="Amount for this installment (₹)">
                <input
                  type="number"
                  min={1}
                  value={amount || ''}
                  onChange={(e) => setAmount(Number(e.target.value) || 0)}
                  className={fieldCls}
                  autoFocus
                />
              </Field>

              {/* Last installment — no other unpaid EMI to absorb a change. */}
              {delta !== 0 && isLast && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2.5 text-[12px] text-amber-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
                  <div>
                    This is the only remaining installment, so there&apos;s nothing to
                    rebalance against — changing it will change the plan total by{' '}
                    <span className="font-semibold">{fmtINR(Math.abs(delta))}</span>.
                  </div>
                </div>
              )}

              {/* Live preview of how the remaining EMIs rebalance once this is paid. */}
              {preview.length > 0 && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2.5 text-[12px] space-y-1">
                  <div className="font-medium text-emerald-800">
                    Once this {fmtINR(amount)} is paid, the remaining installments become:
                  </div>
                  {preview.map((e) => (
                    <div key={e.id} className="flex items-center justify-between text-emerald-700">
                      <span>EMI {e.label}</span>
                      <span className="font-medium">
                        {fmtINR(e.amount)} → {fmtINR(e.newAmount)}
                      </span>
                    </div>
                  ))}
                  <div className="text-[11px] text-emerald-600 pt-0.5 border-t border-emerald-200/70 mt-1">
                    Plan total stays the same.
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-ink-100">
              <Button type="button" onClick={onClose} disabled={busy}>Cancel</Button>
              <Button variant="primary" onClick={submit} disabled={busy}>
                {busy
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating link…</>
                  : <><LinkIcon className="w-3.5 h-3.5" /> Create link for {fmtINR(amount)}</>}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const fieldCls = 'w-full h-9 px-3 rounded-lg border border-ink-200 text-[13px] focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-100 bg-white';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[11.5px] font-medium text-ink-700 mb-1">{label}</div>
      {children}
    </label>
  );
}
