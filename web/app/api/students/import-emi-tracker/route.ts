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
  membership: string;
  tags: string[];
  start_date: string | null;
  end_date: string | null;
  background: string;
  month_1: boolean;
  month_2: boolean;
  month_3: boolean;
  month_4: boolean;
  month_5: boolean;
  month_6: boolean;
  is_super_baker_finisher: boolean;
  bbr_attended: boolean;
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
  let inserted = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      // Find existing by email (unique identifier)
      const { data: existing } = await admin
        .from('students')
        .select('id, background')
        .eq('email', row.email)
        .maybeSingle();

      // Build the data payload (EMI / payment fields intentionally NOT included)
      const data: any = {
        first_name: row.first_name,
        last_name: row.last_name || null,
        mobile: row.mobile || null,
        membership: row.membership,
        tags: row.tags,
        start_date: row.start_date,
        end_date: row.end_date,
        background: row.background || null,
        month_1: row.month_1,
        month_2: row.month_2,
        month_3: row.month_3,
        month_4: row.month_4,
        month_5: row.month_5,
        month_6: row.month_6,
        is_super_baker_finisher: row.is_super_baker_finisher,
        bbr_attended: row.bbr_attended,
      };

      if (existing) {
        // UPDATE — preserves emi_schedule, payment data, payment_link
        // Trigger will auto-sync months → weeks
        const { error } = await admin
          .from('students')
          .update(data)
          .eq('id', (existing as any).id);
        if (error) throw error;
        updated++;
      } else {
        // INSERT new student
        const { error } = await admin
          .from('students')
          .insert({ ...data, email: row.email } as any);
        if (error) throw error;
        inserted++;
      }
    } catch (e: any) {
      errors.push(`${row.email}: ${e.message ?? 'unknown error'}`);
    }
  }

  return NextResponse.json({
    ok: true,
    inserted,
    updated,
    errors: errors.length > 0 ? errors : undefined,
  });
}