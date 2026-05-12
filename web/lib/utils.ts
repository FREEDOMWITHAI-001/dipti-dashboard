// Shared utility helpers — class names, date / money formatters, status helpers.

export function cn(...inputs: Array<string | undefined | null | false>): string {
  return inputs.filter(Boolean).join(' ');
}

export function fmtINR(n: number): string {
  if (Number.isNaN(n)) return '₹0';
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDateShort(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export function daysFromNow(d: string | Date | null | undefined): number | null {
  if (!d) return null;
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return null;
  return Math.ceil((dt.getTime() - Date.now()) / 86400000);
}

export function studentStatusFromEnd(end: string | null | undefined): 'active' | 'expiring' | 'expired' {
  if (!end) return 'active';
  const days = daysFromNow(end);
  if (days === null) return 'active';
  if (days < 0) return 'expired';
  if (days <= 30) return 'expiring';
  return 'active';
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

// Normalize a phone number to E.164 format (e.g. "+917993499776") so GHL /
// WhatsApp can deliver to it. Indian numbers are the default since DVA's
// audience is in India.
//
// Examples:
//   7993499776          → +917993499776
//   07993499776         → +917993499776  (strips leading 0)
//   917993499776        → +917993499776  (adds +)
//   +91 7993 499776     → +917993499776  (strips spaces)
//   (+91) 7993-499776   → +917993499776  (strips parens, dashes)
//   +14155551212        → +14155551212   (foreign number kept as-is)
//
// If the input can't be parsed, returns null so the caller can skip it.
export function normalizePhone(
  raw: string | null | undefined,
  defaultCountryCode = '91'
): string | null {
  if (!raw) return null;
  // Strip everything except digits and a possibly-leading plus.
  let s = String(raw).trim();
  const hasPlus = s.startsWith('+');
  s = s.replace(/[^\d]/g, '');
  if (!s) return null;

  // If the original had a leading +, trust the country code that follows it.
  if (hasPlus) {
    return '+' + s;
  }

  // Strip a leading 0 (common in Indian local-dial format like 09876...).
  if (s.startsWith('0')) s = s.slice(1);

  // If it already starts with the country code and total length looks right,
  // just prepend the + sign.
  if (s.startsWith(defaultCountryCode) && s.length >= 11) {
    return '+' + s;
  }

  // 10-digit Indian mobile → prepend +91.
  if (s.length === 10) {
    return '+' + defaultCountryCode + s;
  }

  // Anything else: best-effort prepend +.
  return '+' + s;
}