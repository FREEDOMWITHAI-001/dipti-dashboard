// Preferred payment methods a student can be set to, used to tailor EMI
// reminders. Add or remove options here — the Add Student dropdown, the Profile
// tab editor, the reminder preview wording, and the GHL payload all read from
// this one list. To add a method: add it here AND a case in paymentCta() below.
export const PAYMENT_TYPES = [
  'UPI',
  'Card',
  'Net Banking',
  'NEFT',
  'RTGS',
  'IMPS',
  'Bank Transfer',
  'Wallet',
  'QR Code',
  'Auto-debit / Mandate',
  'Cash',
  'Cheque',
  'Demand Draft',
  'Other',
] as const;

export type PaymentType = (typeof PAYMENT_TYPES)[number];

// The call-to-action line in a reminder, tailored to the student's preferred
// method. Falls back to a neutral "Pay here" when no method is set or it's
// unrecognised. This is what makes the reminder "payment-type specific".
export function paymentCta(type: string | null | undefined): string {
  switch ((type ?? '').trim().toLowerCase()) {
    case 'upi':                  return 'Pay via UPI here';
    case 'card':                 return 'Pay by card here';
    case 'net banking':          return 'Pay via net banking here';
    case 'neft':                 return 'Pay via NEFT here';
    case 'rtgs':                 return 'Pay via RTGS here';
    case 'imps':                 return 'Pay via IMPS here';
    case 'bank transfer':        return 'Pay via bank transfer here';
    case 'wallet':               return 'Pay via wallet here';
    case 'qr code':              return 'Scan the QR / pay here';
    case 'auto-debit / mandate': return 'Your EMI will be auto-debited — details here';
    case 'cash':                 return 'For your cash payment, details here';
    case 'cheque':               return 'For your cheque payment, details here';
    case 'demand draft':         return 'For your demand draft, details here';
    default:                     return 'Pay here';
  }
}

// Canonicalise a raw method string — a manually-picked mode ("Bank Transfer")
// or a Cashfree payment_group ("credit_card", "net_banking") — to one of
// PAYMENT_TYPES. Returns null for empty or the generic "Cashfree" gateway label
// (which names no specific method).
export function normalizePaymentMethod(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim().toLowerCase();
  if (!s || s === 'cashfree' || s === 'other') return null;
  if (s.includes('upi')) return 'UPI';
  if (s.includes('net') && s.includes('bank')) return 'Net Banking'; // net_banking / netbanking
  if (s.includes('card')) return 'Card';                             // credit_card / debit_card
  if (s.includes('wallet') || s === 'app') return 'Wallet';
  if (s.includes('imps')) return 'IMPS';
  if (s.includes('rtgs')) return 'RTGS';
  if (s.includes('neft')) return 'NEFT';
  if (s.includes('bank')) return 'Bank Transfer';
  if (s.includes('cash')) return 'Cash';
  if (s.includes('cheque') || s.includes('check')) return 'Cheque';
  if (s.includes('demand') || s === 'dd') return 'Demand Draft';
  if (s.includes('qr')) return 'QR Code';
  return (raw ?? '').trim() || null; // keep an unmapped-but-meaningful value as-is
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
