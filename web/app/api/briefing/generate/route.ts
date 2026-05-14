import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { generateBriefing } from '@/lib/ai/briefing';

// POST /api/briefing/generate
// body: { studentId }
// Pulls student + calls + emi → AI provider → caches in student_briefings.
export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: Request) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return new NextResponse('unauthenticated', { status: 401 });

  const { studentId } = (await req.json()) as { studentId: string };
  if (!studentId) return new NextResponse('studentId required', { status: 400 });

  const [{ data: student }, { data: calls }, { data: emi }] = await Promise.all([
    sb.from('students').select('first_name,last_name,membership,tags,start_date,end_date,background,month_1,month_2,month_3,month_4,month_5,month_6').eq('id', studentId).maybeSingle(),
    sb.from('call_logs')
      .select('created_at, comment, outcome, next_action, coach:profiles(initials)')
      .eq('student_id', studentId)
      .order('created_at')
      .limit(50),
    sb.from('emi_schedule').select('installment_no, installments_total, amount, due_date, status, paid_date').eq('student_id', studentId).order('installment_no'),
  ]);

  if (!student) return new NextResponse('student not found', { status: 404 });

  const callRows = (calls ?? []).map((c: any) => ({
    created_at: c.created_at,
    comment: c.comment,
    outcome: c.outcome,
    next_action: c.next_action,
    coach_initials: c.coach?.initials ?? '?',
  }));

  const result = await generateBriefing({
    student: student as any,
    calls: callRows,
    emi: (emi ?? []) as any,
  });

  // cache via admin (bypasses RLS write restriction on briefings)
  const admin = supabaseAdmin();
  await admin.from('student_briefings').upsert({
    student_id: studentId,
    summary_md: result.briefing_md,
    is_stale: false,
    source_calls_count: callRows.length,
    source_max_call_at: callRows.at(-1)?.created_at ?? null,
    generated_at: new Date().toISOString(),
    model: result.model,
    tokens_in: result.tokens_in,
    tokens_out: result.tokens_out,
  });

  return NextResponse.json({
    summary_md: result.briefing_md,
    model: result.model,
    tokens_in: result.tokens_in,
    tokens_out: result.tokens_out,
    provider: result.provider,
    source_calls_count: callRows.length,
  });
}