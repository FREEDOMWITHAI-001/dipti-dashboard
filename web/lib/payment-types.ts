// Preferred payment methods a student can be set to, used to tailor EMI
// reminders. Add or remove options here — the Add Student dropdown, the Profile
// tab editor, the reminder preview wording, and the GHL payload all read from
// this one list. To add a method: add it here AND a case in paymentCta() below.
export const PAYMENT_TYPES = [
  'UPI',
  'NEFT',
  'Card',
] as const;

export type PaymentType = (typeof PAYMENT_TYPES)[number];

// The call-to-action line in a reminder, tailored to the student's preferred
// method. Falls back to a neutral "Pay here" when no method is set or it's
// unrecognised. This is what makes the reminder "payment-type specific".
export function paymentCta(type: string | null | undefined): string {
  switch ((type ?? '').trim().toLowerCase()) {
    case 'upi':  return 'Pay via UPI here';
    case 'neft': return 'Pay via NEFT here';
    case 'card': return 'Pay by card here';
    default:     return 'Pay here';
  }
}

// The full WhatsApp message a reminder sends, per payment type. This MUST mirror
// the three GHL templates word-for-word so the in-app preview matches what the
// student actually receives:
//   UPI  → {{1}} name, {{2}} amount, {{3}} due date
//   NEFT → {{1}} name, {{2}} amount, {{3}} due date
//   Card → {{1}} name, {{2}} amount, {{3}} due date, {{4}} payment link
// `amount` is passed already formatted with the ₹ symbol (e.g. "₹1,234").
// A type that isn't set / unrecognised falls back to the UPI wording (the
// generic "pay to the number or QR" message), matching the default GHL workflow.
export function reminderTemplate(
  type: string | null | undefined,
  v: { name: string; amount: string; dueDate: string; paymentLink: string },
): string {
  switch ((type ?? '').trim().toLowerCase()) {
    case 'neft':
      return `Hi ${v.name}, Your EMI of ${v.amount} is due on ${v.dueDate}. You can do the NEFT to the same account.\nTeam DVA`;
    case 'card':
      return `Hi ${v.name}, Your EMI of ${v.amount} is due on ${v.dueDate}. Payment link: ${v.paymentLink}\nTeam DVA`;
    case 'upi':
    default:
      return `Hi ${v.name}, Your EMI of ${v.amount} is due on ${v.dueDate}. You can pay on 7400182818 or the above QR Code\nTeam DVA`;
  }
}

// Canonicalise a raw method string — a manually-picked mode ("Card") or a
// Cashfree payment_group ("credit_card", "debit_card") — to one of PAYMENT_TYPES.
// Only UPI / NEFT / Card are recognised; everything else (bank transfer, wallet,
// cash, the generic "Cashfree" label, etc.) returns null so a recorded payment
// can never set a payment_type that isn't a valid option.
export function normalizePaymentMethod(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim().toLowerCase();
  if (!s) return null;
  if (s.includes('upi')) return 'UPI';
  if (s.includes('neft')) return 'NEFT';
  if (s.includes('card')) return 'Card'; // credit_card / debit_card
  return null;
}

// Record a student's preferred payment_type from the method used on a payment,
// but ONLY when it isn't set yet — so the FIRST recorded payment establishes it
// and neither later payments nor a manually-chosen type get overwritten.
// Works with any Supabase client (browser or admin). Best-effort: never throws.
export async function backfillPaymentType(
  sb: { from: (t: string) => any },
  studentId: string,
  rawMethod: string | null | undefined,
): Promise<void> {
  try {
    const method = normalizePaymentMethod(rawMethod);
    if (!studentId || !method) return;
    const { data } = await sb.from('students').select('payment_type').eq('id', studentId).maybeSingle();
    const current = (data as any)?.payment_type;
    if (current == null || String(current).trim() === '') {
      await sb.from('students').update({ payment_type: method }).eq('id', studentId);
    }
  } catch {
    // Non-critical — a failure here must never block marking a payment paid.
  }
}
