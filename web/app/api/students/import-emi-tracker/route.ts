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
  payment_link?: string | null;
  month_1?: boolean; month_2?: boolean; month_3?: boolean;
  month_4?: boolean; month_5?: boolean; month_6?: boolean;
  is_super_baker_finisher?: boolean;
  is_hall_of_fame?: boolean;
  certificate_issued?: boolean;
  certificate_issued_date?: string | null;
  bbr_attended?: boolean;
  bbr_attended_date?: string | null;
  background?: string | null;
  call_logs?: { date: string | null; comment: string; coach_label: string }[];
  membership?: string | null;
  tags?: string[];
  start_date?: string | null;
  end_date?: string | null;
  course_end_date?: string | null;
};

// Build optional achievement/progress fields (only include keys that are defined)
function achievementFields(row: ParsedRow): Record<string, any> {
  const f: Record<string, any> = {};
  if (row.month_1 !== undefined) f.month_1 = row.month_1;
  if (row.month_2 !== undefined) f.month_2 = row.month_2;
  if (row.month_3 !== undefined) f.month_3 = row.month_3;
  if (row.month_4 !== undefined) f.month_4 = row.month_4;
  if (row.month_5 !== undefined) f.month_5 = row.month_5;
  if (row.month_6 !== undefined) f.month_6 = row.month_6;
  if (row.is_super_baker_finisher !== undefined) f.is_super_baker_finisher = row.is_super_baker_finisher;
  if (row.is_hall_of_fame !== undefined) f.is_hall_of_fame = row.is_hall_of_fame;
  if (row.certificate_issued !== undefined) f.certificate_issued = row.certificate_issued;
  if (row.certificate_issued_date) f.certificate_issued_date = row.certificate_issued_date;
  if (row.bbr_attended !== undefined) f.bbr_attended = row.bbr_attended;
  if (row.bbr_attended_date) f.bbr_attended_date = row.bbr_attended_date;
  if (row.background) f.background = row.background;
  if (row.membership !== undefined && row.membership !== null) f.membership = row.membership;
  if (row.tags !== undefined) f.tags = row.tags;
  if (row.start_date) f.start_date = row.start_date;
  if (row.end_date) f.end_date = row.end_date;
  if (row.course_end_date) f.course_end_date = row.course_end_date;
  return f;
}

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
          ...achievementFields(row),  // course progress + achievements (if present in sheet)
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
            ...achievementFields(row),  // course progress + achievements (if present in sheet)
          } as any)
          .select('id')
          .single();
        if (error) throw error;
        studentId = (created as any).id;
      }

      // Import call logs (if present in the sheet) — duplicate-safe
      if (row.call_logs && row.call_logs.length > 0) {
        for (const call of row.call_logs) {
          const { data: dupe } = await admin
            .from('call_logs')
            .select('id')
            .eq('student_id', studentId)
            .eq('comment', `[${call.coach_label}] ${call.comment}`)
            .maybeSingle();
          if (dupe) continue;
          await admin.from('call_logs').insert({
            student_id: studentId,
            coach_id: user.id,
            comment: `[${call.coach_label}] ${call.comment}`,
            outcome: 'connected',
            created_at: call.date ? new Date(call.date).toISOString() : new Date().toISOString(),
          } as any);
        }
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