/**
 * One-shot importer for DVA's two legacy Excel sheets.
 *
 *   Master Sheet → public.students  (+ monthly progress)
 *   EMI Tracker  → public.emi_schedule
 *
 * Usage:
 *   cd web
 *   pnpm tsx ../scripts/import-excel.ts --dry-run     # preview
 *   pnpm tsx ../scripts/import-excel.ts               # actually write
 *
 * Env required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from '@supabase/supabase-js';
import { read, utils } from 'xlsx';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DRY_RUN = process.argv.includes('--dry-run');
const ROOT = resolve(__dirname, '..');

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

function parseDate(v: any): string | null {
  if (!v) return null;
  if (typeof v === 'number') {
    // Excel serial date
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return d.toISOString().slice(0, 10);
  }
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function parseTags(v: any): string[] {
  if (!v) return [];
  return String(v).split(/[,;|\s]+/).filter(Boolean);
}

async function importMaster() {
  const path = resolve(ROOT, 'DVA_Diamond_Master_sheet.xlsx');
  const wb = read(readFileSync(path));
  const ws = wb.Sheets['Diamond Master Sheet'];
  const rows = utils.sheet_to_json<any>(ws, { defval: null, blankrows: false });

  console.log(`Master sheet: ${rows.length} rows`);
  let inserted = 0, skipped = 0;

  for (const r of rows) {
    if (!r['Email'] || typeof r['Email'] !== 'string') { skipped++; continue; }
    const email = String(r['Email']).trim().toLowerCase();
    const payload = {
      email,
      first_name: r['First Name'] ?? null,
      last_name: r['Last Name'] ?? null,
      mobile: r['Mobile Number'] ? '+' + String(r['Mobile Number']).replace(/\D/g, '') : null,
      membership: r['Membership'] ?? null,
      tags: parseTags(r['Tags']),
      start_date: parseDate(r['Start Date']),
      end_date: parseDate(r['End Date']),
      background: r['Background'] ?? null,
      upgrade_flag: String(r['Call'] ?? '').toLowerCase() === 'upgrade',
      month_1: r['Month 1'] === true || String(r['Month 1']).toLowerCase() === 'true',
      month_2: r['Month 2'] === true || String(r['Month 2']).toLowerCase() === 'true',
      month_3: r['Month 3'] === true || String(r['Month 3']).toLowerCase() === 'true',
      month_4: r['Month 4'] === true || String(r['Month 4']).toLowerCase() === 'true',
      month_5: r['Month 5'] === true || String(r['Month 5']).toLowerCase() === 'true',
      month_6: r['Month 6'] === true || String(r['Month 6']).toLowerCase() === 'true',
    };

    if (DRY_RUN) {
      console.log('[dry] upsert', email, payload.first_name);
    } else {
      const { error } = await sb.from('students').upsert(payload, { onConflict: 'email', ignoreDuplicates: false });
      if (error) { console.error('error on', email, error.message); skipped++; }
      else inserted++;
    }
  }
  console.log(`Master done: ${inserted} written, ${skipped} skipped`);
}

async function importEmi() {
  const path = resolve(ROOT, 'Diamond_EMI_Tracker.xlsx');
  const wb = read(readFileSync(path));
  const ws = wb.Sheets['EMI Tracker'];
  const rows = utils.sheet_to_json<any>(ws, { defval: null, blankrows: false });

  console.log(`EMI sheet: ${rows.length} rows`);
  let inserted = 0, skipped = 0;

  for (const r of rows) {
    const email = r['Email Id'] ? String(r['Email Id']).trim().toLowerCase() : null;
    if (!email) { skipped++; continue; }

    const { data: student } = await sb.from('students').select('id').eq('email', email).maybeSingle();
    if (!student) { console.warn('student not found for', email); skipped++; continue; }

    const installmentStr = String(r['EMI'] ?? '').trim();      // "5/9"
    const [n, total] = installmentStr.split('/').map(Number);
    if (!n || !total) { skipped++; continue; }

    const amount = Number(String(r['EMI amount'] ?? '').replace(/[,\s]/g, '')) || 0;
    const due = parseDate(r['Due Date']);
    const remind = parseDate(r['Reminder Date']) ?? due;
    if (!due || !amount) { skipped++; continue; }

    const payload = {
      student_id: student.id,
      installment_no: n,
      installments_total: total,
      amount,
      due_date: due,
      reminder_date: remind!,
      payment_link: r['Unnamed: 9'] ?? r['Payment Link'] ?? null,
      payment_mode: r['Unnamed: 8'] ?? null,
      status: r['Status'] === 'Paid' ? 'paid' : 'upcoming',
      paid_date: parseDate(r['Paid date']),
    };

    if (DRY_RUN) {
      console.log('[dry] EMI', email, installmentStr, amount);
    } else {
      const { error } = await sb.from('emi_schedule').upsert(payload, { onConflict: 'student_id,installment_no' });
      if (error) { console.error('emi error', email, error.message); skipped++; }
      else inserted++;
    }
  }
  console.log(`EMI done: ${inserted} written, ${skipped} skipped`);
}

(async () => {
  if (DRY_RUN) console.log('=== DRY RUN — no writes ===');
  await importMaster();
  await importEmi();
  console.log('All done.');
})().catch((e) => { console.error(e); process.exit(1); });
