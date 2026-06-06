'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, IndianRupee, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useToast } from '@/components/shell/toast-region';
import { fmtINR } from '@/lib/utils';
import { PAYMENT_TYPES } from '@/lib/payment-types';

// Reusable EMI setup form.
// Used by:
//   1. AddStudent modal — inline (no Save button of its own; the parent handles save)
//   2. PaymentsTab — standalone modal with its own Save button for existing students

export type EmiSetupValue = {
  total_fee: number;
  down_payment: number;
  down_payment_date: string;
  num_installments: number;
  monthly_amount: number;
  first_due_date: string;
  reminder_days_before: number;
  payment_link: string;
  payment_type: string;
};

const defaults: EmiSetupValue = {
  total_fee: 0,
  down_payment: 0,
  down_payment_date: new Date().toISOString().slice(0, 10),
  num_installments: 0,
  monthly_amount: 0,
  first_due_date: '',
  // Reminders always fire 2 days before the due date — no longer user-editable,
  // kept here so EMI rows still store reminder_date = due - 2.
  reminder_days_before: 2,
  payment_link: '',
  payment_type: '',
};

export function EmiSetupForm({
  value, onChange,
}: {
  value: EmiSetupValue;
  onChange: (v: EmiSetupValue) => void;
}) {
  // Auto-compute monthly amount when total/down/installments change,
  // BUT only if the user hasn't manually overridden it.
  const computed = useMemo(() => {
    const remaining = Math.max(0, (value.total_fee ?? 0) - (value.down_payment ?? 0));
    const n = Math.max(1, value.num_installments ?? 1);
    return Math.round(remaining / n);
  }, [value.total_fee, value.down_payment, value.num_installments]);

  useEffect(() => {
    if (value.monthly_amount === 0 || value.monthly_amount === computed) {
      onChange({ ...value, monthly_amount: computed });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computed]);

  function set<K extends keyof EmiSetupValue>(k: K, v: EmiSetupValue[K]) {
    onChange({ ...value, [k]: v });
  }

  const totalEmi = value.monthly_amount * value.num_installments;
  const drift = totalEmi - Math.max(0, (value.total_fee ?? 0) - (value.down_payment ?? 0));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Total course fee (₹)">
          <input type="number" min={0}
            value={value.total_fee || ''}
            onChange={(e) => set('total_fee', Number(e.target.value) || 0)}
            className={fieldCls} placeholder="250000" />
        </Field>
        <Field label="Down payment (₹)">
          <input type="number" min={0}
            value={value.down_payment || ''}
            onChange={(e) => set('down_payment', Number(e.target.value) || 0)}
            className={fieldCls} placeholder="40000" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Down payment date">
          <input type="date"
            value={value.down_payment_date}
            onChange={(e) => set('down_payment_date', e.target.value)}
            className={fieldCls} />
        </Field>
        <Field label="Number of installments">
          <input type="number" min={0} max={36}
            value={value.num_installments}
            onChange={(e) => set('num_installments', Math.max(0, Number(e.target.value) || 0))}
            className={fieldCls} placeholder="0" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Monthly amount (₹)">
          <input type="number" min={0}
            value={value.monthly_amount || ''}
            onChange={(e) => set('monthly_amount', Number(e.target.value) || 0)}
            className={fieldCls} placeholder={String(computed)} />
        </Field>
        <Field label="First due date">
          <input type="date"
            value={value.first_due_date}
            onChange={(e) => set('first_due_date', e.target.value)}
            className={fieldCls} />
        </Field>
      </div>

      <Field label="Payment type (optional)">
        <select
          value={value.payment_type}
          onChange={(e) => set('payment_type', e.target.value)}
          className={fieldCls}>
          <option value="">Not set</option>
          {PAYMENT_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <div className="text-[11px] text-ink-500 mt-1">
          Preferred method — tailors the wording of every EMI reminder to this payment type.
        </div>
      </Field>

      <Field label="Payment link (optional)">
        <input type="url"
          value={value.payment_link}
          onChange={(e) => set('payment_link', e.target.value)}
          className={fieldCls}
          placeholder="https://rzp.io/i/... or any payment URL" />
        <div className="text-[11px] text-ink-500 mt-1">
          This link will be included in every EMI reminder sent to the student.
        </div>
      </Field>

      {value.total_fee > 0 && (
        <div className="rounded-lg bg-ink-50/70 border border-ink-200/70 p-3 text-[12.5px] space-y-0.5">
          <div className="flex justify-between">
            <span className="text-ink-500">Down payment</span>
            <span className="font-medium">{fmtINR(value.down_payment)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-500">{value.num_installments} × {fmtINR(value.monthly_amount)} (EMIs)</span>
            <span className="font-medium">{fmtINR(totalEmi)}</span>
          </div>
          <div className="flex justify-between pt-1 border-t border-ink-200/70 mt-1">
            <span className="text-ink-700 font-medium">Plan total</span>
            <span className="font-semibold">{fmtINR(value.down_payment + totalEmi)}</span>
          </div>
          {Math.abs(drift) > 1 && (
            <div className={`text-[11px] mt-1 ${drift > 0 ? 'text-amber-700' : 'text-rose-700'}`}>
              {drift > 0
                ? `Plan exceeds total fee by ${fmtINR(drift)}. Adjust monthly amount or installments.`
                : `Plan is short of total fee by ${fmtINR(-drift)}. Adjust to balance.`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function emiDefaults(): EmiSetupValue {
  return { ...defaults };
}

/**
 * Persist an EMI setup for a student:
 *  - updates students table with total_fee + down_payment + down_payment_date
 *  - inserts N rows into emi_schedule with monthly increments
 */
export async function saveEmiPlan(
  sb: ReturnType<typeof supabaseBrowser>,
  studentId: string,
  value: EmiSetupValue
): Promise<{ ok: boolean; error?: string }> {
  // 1. Update student
  const { error: stuErr } = await sb.from('students').update({
    total_fee: value.total_fee || null,
    down_payment: value.down_payment || null,
    down_payment_date: value.down_payment_date || null,
    payment_link: value.payment_link?.trim() || null,
    payment_type: value.payment_type || null,
  } as any).eq('id', studentId);
  if (stuErr) return { ok: false, error: stuErr.message };

  // 2. Build EMI rows
  if (!value.first_due_date || value.monthly_amount <= 0 || value.num_installments <= 0) {
    return { ok: true }; // student saved but no EMI schedule created
  }

  const start = new Date(value.first_due_date);
  if (Number.isNaN(start.getTime())) return { ok: false, error: 'Invalid first due date.' };

  // 3. Get existing EMIs so we can preserve paid ones
  const { data: existing } = await sb
    .from('emi_schedule')
    .select('installment_no, amount, due_date, status, paid_date, paid_via, paid_notes, reminder_date, cashfree_link_id, cashfree_link_url, original_amount')
    .eq('student_id', studentId)
    .order('installment_no');

  const allExisting = ((existing ?? []) as any[]);
  const paidExisting = allExisting.filter((r) => r.status === 'paid');
  // Index UNPAID existing rows by installment number so an unchanged installment
  // that already has a generated Cashfree link keeps it when the plan is
  // re-saved. Without this, the delete-then-reinsert below dropped
  // cashfree_link_id/url and orphaned a link that's still payable at Cashfree
  // (its webhook would then hit "no matching EMI" and never auto-mark it paid).
  const unpaidByNo = new Map<number, any>();
  for (const r of allExisting) if (r.status !== 'paid') unpaidByNo.set(r.installment_no, r);

  // 4. Delete ALL existing EMI rows (we'll re-insert paid + new unpaid)
  const { error: delErr } = await sb.from('emi_schedule').delete().eq('student_id', studentId);
  if (delErr) return { ok: false, error: delErr.message };

  // 5. Build new rows — keep paid ones unchanged (preserve their amounts/dates),
  //    add new unpaid rows for the rest using the new monthly_amount.
  const newRows: any[] = [];

  // Re-insert paid rows as they were
  for (const p of paidExisting) {
    newRows.push({
      student_id: studentId,
      installment_no: p.installment_no,
      installments_total: value.num_installments,
      amount: p.amount,
      due_date: p.due_date,
      reminder_date: p.reminder_date,
      status: 'paid',
      paid_date: p.paid_date,
      paid_via: p.paid_via,
      paid_notes: p.paid_notes,
    });
  }

  // Add new unpaid rows to fill up to num_installments
  const paidNumbers = new Set(paidExisting.map((p) => p.installment_no));
  for (let i = 1; i <= value.num_installments; i++) {
    if (paidNumbers.has(i)) continue;
    const due = new Date(start);
    due.setMonth(due.getMonth() + (i - 1));
    const remind = new Date(due);
    remind.setDate(remind.getDate() - value.reminder_days_before);
    const dueStr = due.toISOString().slice(0, 10);
    const row: any = {
      student_id: studentId,
      installment_no: i,
      installments_total: value.num_installments,
      amount: value.monthly_amount,
      due_date: dueStr,
      reminder_date: remind.toISOString().slice(0, 10),
      status: 'upcoming',
    };
    // Carry over a live Cashfree link only when this installment is regenerated
    // UNCHANGED (same number, amount, and due date). A genuinely edited
    // installment regenerates fresh exactly as before — no behaviour change.
    const prevUnpaid = unpaidByNo.get(i);
    if (
      prevUnpaid &&
      (prevUnpaid.cashfree_link_id || prevUnpaid.cashfree_link_url) &&
      Number(prevUnpaid.amount) === Number(value.monthly_amount) &&
      String(prevUnpaid.due_date).slice(0, 10) === dueStr
    ) {
      row.cashfree_link_id = prevUnpaid.cashfree_link_id ?? null;
      row.cashfree_link_url = prevUnpaid.cashfree_link_url ?? null;
      if (prevUnpaid.original_amount != null) row.original_amount = prevUnpaid.original_amount;
    }
    newRows.push(row);
  }

  if (newRows.length === 0) return { ok: true };

  const { error: emiErr } = await sb.from('emi_schedule').insert(newRows as any);
  if (emiErr) return { ok: false, error: emiErr.message };
  return { ok: true };
}

/** Standalone modal — opened from the Payments tab when a student has no EMI yet. */
export function EmiSetupModal({
  studentId, onClose, onSaved,
}: {
  studentId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const sb = supabaseBrowser();
  const { toast } = useToast();
  const [value, setValue] = useState<EmiSetupValue>(emiDefaults());
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  // Pre-load existing student EMI data so editing pre-fills correctly.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: stu }, { data: rows }] = await Promise.all([
        sb.from('students').select('total_fee, down_payment, down_payment_date, payment_link, payment_type').eq('id', studentId).maybeSingle(),
        sb.from('emi_schedule').select('amount, installment_no, due_date').eq('student_id', studentId).order('installment_no'),
      ]);
      if (cancelled) return;
      const existingRows = (rows ?? []) as any[];
      if (stu || existingRows.length > 0) {
        const firstDue = existingRows[0]?.due_date ?? new Date().toISOString().slice(0, 10);
        setValue({
          total_fee:            Number((stu as any)?.total_fee ?? 0),
          down_payment:         Number((stu as any)?.down_payment ?? 0),
          down_payment_date:    (stu as any)?.down_payment_date ?? new Date().toISOString().slice(0, 10),
          num_installments:     existingRows.length || 0,
          monthly_amount:       Number(existingRows[0]?.amount ?? 0),
          first_due_date:       firstDue,
          reminder_days_before: 2,
          payment_link:         (stu as any)?.payment_link ?? '',
          payment_type:         (stu as any)?.payment_type ?? '',
        });
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  async function save() {
    setBusy(true);
    const out = await saveEmiPlan(sb, studentId, value);
    setBusy(false);
    if (!out.ok) { toast(out.error ?? 'Failed.', 'error'); return; }
    toast('EMI plan saved.', 'success');
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center pt-[6vh] px-4" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-[560px] bg-white rounded-2xl shadow-pop border border-ink-200/70 overflow-hidden max-h-[88vh] flex flex-col" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 h-14 border-b border-ink-100 shrink-0">
          <div className="flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-ink-500" />
            <div className="font-semibold text-[15px]">Set up EMI plan</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-md hover:bg-ink-100 grid place-items-center" aria-label="Close">
            <X className="w-4 h-4 text-ink-500" />
          </button>
        </div>

        <div className="p-5 overflow-auto">
          {loading ? (
            <div className="py-8 text-center text-[13px] text-ink-500">Loading existing plan…</div>
          ) : (
            <EmiSetupForm value={value} onChange={setValue} />
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-ink-100 shrink-0">
          <Button type="button" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={busy}>
            {busy ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : 'Save EMI plan'}
          </Button>
        </div>
      </div>
    </div>
  );
}

const fieldCls = 'w-full h-9 px-3 rounded-lg border border-ink-200 focus:border-accent-500 focus:ring-2 focus:ring-accent-100 outline-none text-[13.5px] bg-white';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[12px] font-medium text-ink-700 mb-1">{label}</div>
      {children}
    </label>
  );
}