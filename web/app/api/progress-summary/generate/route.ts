import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { generateProgressSummary } from '@/lib/ai/progress-summary';
 
// POST /api/progress-summary/generate
// body: { studentId }
// Pulls student + calls + emi → Claude Haiku → returns markdown summary.
// No DB caching (regenerated on demand from the client).
export const runtime = 'nodejs';
export const maxDuration = 30;
 
export async function POST(req: Request) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return new NextResponse('unauthenticated', { status: 401 });
 
  const { studentId } = (await req.json()) as { studentId: string };
  if (!studentId) return new NextResponse('studentId required', { status: 400 });
 
  const [{ data: student }, { data: calls }, { data: emi }] = await Promise.all([
    sb.from('students')
      .select('first_name,last_name,membership,tags,start_date,end_date,background,month_1,month_2,month_3,month_4,month_5,month_6')
      .eq('id', studentId)
      .maybeSingle(),
    sb.from('call_logs')
      .select('created_at, comment, outcome, next_action, coach:profiles(initials)')
      .eq('student_id', studentId)
      .order('created_at')
      .limit(50),
    sb.from('emi_schedule')
      .select('installment_no, installments_total, amount, due_date, status, paid_date')
      .eq('student_id', studentId)
      .order('installment_no'),
  ]);
 
  if (!student) return new NextResponse('student not found', { status: 404 });
 
  const callRows = (calls ?? []).map((c: any) => ({
    created_at: c.created_at,
    comment: c.comment,
    outcome: c.outcome,
    next_action: c.next_action,
    coach_initials: c.coach?.initials ?? '?',
  }));
 
  const result = await generateProgressSummary({
    student: student as any,
    calls: callRows,
    emi: (emi ?? []) as any,
  });
 
  return NextResponse.json({
    summary_md: result.summary_md,
    model: result.model,
    source_calls_count: callRows.length,
    generated_at: new Date().toISOString(),
  });
}