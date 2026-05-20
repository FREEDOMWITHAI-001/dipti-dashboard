import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const maxDuration = 60;

type ParsedRow = {
  email: string;
  first_name: string;
  last_name: string;
  mobile: string;
  emi_current: number;
  emi_total: number;
  emi_amount: number;
  due_date: string;
  payment_mode: string;
  total_fee: number;
};

export async function POST(req: Request) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Not signed in' }, { status: 401 });

  const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if ((profile as any)?.role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'Admin only' }, { status: 403 });
  }

  const { rows }: { rows: ParsedRow[] } = await req.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ ok: false, error: 'No rows provided' }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);

  let importedStudents = 0;
  let createdEmis = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      // Find or create student
      const { data: existing } = await admin
        .from('students')
        .select('id, tags')
        .eq('email', row.email)
        .maybeSingle();

      let studentId: string;
      if (existing) {
        // Update
        // Update student info but PRESERVE existing tags
        await admin.from('students').update({
          first_name: row.first_name,
          last_name: row.last_name || null,
          mobile: row.mobile || null,
          total_fee: row.total_fee,
          membership: 'Diamond',
          // tags intentionally not modified — preserve whatever's there
        } as any).eq('id', (existing as any).id);
        studentId = (existing as any).id;
      } else {
        // Insert
        const { data: created, error } = await admin
          .from('students')
          .insert({
            email: row.email,
            first_name: row.first_name,
            last_name: row.last_name || null,
            mobile: row.mobile || null,
            total_fee: row.total_fee,
            membership: 'Diamond',
          } as any)
          .select('id')
          .single();
        if (error) throw error;
        studentId = (created as any).id;
      }

      // ⚠️ EMI Tracker import REPLACES EMI plan (intentional — this importer's purpose)
      // For other imports (progress sheets, etc), create separate routes that DON'T delete EMIs
      await admin.from('emi_schedule').delete().eq('student_id', studentId);

      // Build EMI rows
      // Interpretation: "X/Y" in tracker means "X PAID out of Y total"
      //   So installments 1..X are PAID, (X+1)..Y are UPCOMING
      //   The "Due Date" column = date of next due EMI (i.e. EMI #(X+1))
      //   For 15/15 case: all paid, no upcoming
      const emiRows = [];
      for (let i = 1; i <= row.emi_total; i++) {
        // offsetMonths from NEXT due EMI (which is X+1).
        // EMI #i compared to "next due" (X+1): offset = i - (X+1) months
        const offsetMonths = i - (row.emi_current + 1);
        const instDate = addMonths(row.due_date, offsetMonths);
        const reminderDate = subDays(instDate, 2);
        
        let status: string;
        let paidDate: string | null = null;
        let paymentMode: string | null = null;
        
        if (i <= row.emi_current) {
          // PAID — installments 1..X are paid
          status = 'paid';
          paidDate = instDate;
          paymentMode = row.payment_mode;
        } else if (instDate < today) {
          status = 'overdue';
        } else if (instDate === today) {
          status = 'due_soon';
        } else {
          status = 'upcoming';
        }
        
        emiRows.push({
          student_id: studentId,
          installment_no: i,
          installments_total: row.emi_total,
          amount: row.emi_amount,
          due_date: instDate,
          reminder_date: reminderDate,
          status,
          paid_date: paidDate,
          payment_mode: paymentMode,
        });
      }

      const { error: emiError } = await admin.from('emi_schedule').insert(emiRows as any);
      if (emiError) throw emiError;

      importedStudents++;
      createdEmis += emiRows.length;
    } catch (e: any) {
      errors.push(`${row.email}: ${e.message ?? 'unknown error'}`);
    }
  }

  return NextResponse.json({
    ok: true,
    imported: importedStudents,
    emis: createdEmis,
    errors: errors.length > 0 ? errors : undefined,
  });
}

function addMonths(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

function subDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}