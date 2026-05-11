import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { dispatchReminder } from '@/lib/events';

// POST /api/ghl/trigger-workflow
// body: { studentId, emiId?, channel?, payload? }
// Inserts a `reminders` row and fires the relevant GHL workflow.

export async function POST(req: Request) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return new NextResponse('unauthenticated', { status: 401 });

  const body = (await req.json()) as {
    studentId: string;
    emiId?: string;
    channel?: 'whatsapp' | 'sms' | 'email';
    payload?: Record<string, unknown>;
    eventId?: string;
  };
  if (!body.studentId) return new NextResponse('studentId required', { status: 400 });

  const { data: student } = await sb.from('students').select('id, ghl_contact_id, first_name').eq('id', body.studentId).maybeSingle();
  if (!student) return new NextResponse('student not found', { status: 404 });

  const eventId = (body.eventId ?? 'emi.reminder_due') as any;

  // Look up the configured workflow id for this event
  const { data: ev } = await sb.from('reminder_events').select('default_workflow_id').eq('id', eventId).maybeSingle();
  const workflowId = ev?.default_workflow_id ?? null;

  const result = await dispatchReminder(sb, {
    event: eventId,
    studentId: student.id,
    emiId: body.emiId ?? undefined,
    ghlContactId: student.ghl_contact_id ?? null,
    workflowId,
    payload: body.payload ?? {},
    triggeredBy: user.id,
    channel: body.channel ?? 'whatsapp',
  });

  return NextResponse.json(result);
}
