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
