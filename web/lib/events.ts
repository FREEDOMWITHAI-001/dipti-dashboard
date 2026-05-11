// Reminder dispatch + sweep helpers used by cron routes and manual trigger API.

import type { SupabaseClient } from '@supabase/supabase-js';
import { ghlTriggerWorkflow, GhlError } from '@/lib/ghl/client';

type AnyClient = SupabaseClient<any, any, any>;

export async function dispatchReminder(sb: AnyClient, args: {
  event: string;
  studentId: string;
  emiId?: string;
  ghlContactId: string | null;
  workflowId: string | null;
  payload: Record<string, unknown>;
  triggeredBy: string | null;
  channel?: 'whatsapp' | 'sms' | 'email';
}) {
  const insert = {
    event_id: args.event,
    student_id: args.studentId,
    emi_id: args.emiId ?? null,
    ghl_workflow_id: args.workflowId,
    ghl_contact_id: args.ghlContactId,
    channel: args.channel ?? 'whatsapp',
    payload: args.payload,
    status: 'queued' as const,
    triggered_by: args.triggeredBy,
  };

  const { data: row, error: insertErr } = await sb
    .from('reminders').insert(insert).select('id').single();
  if (insertErr) return { ok: false, error: insertErr.message };

  if (!args.workflowId || !args.ghlContactId) {
    await sb.from('reminders').update({
      status: 'failed',
      error: !args.workflowId ? 'workflow_id missing' : 'ghl_contact_id missing',
    }).eq('id', row.id);
    return { ok: false, reminderId: row.id, error: 'configuration missing' };
  }

  try {
    await ghlTriggerWorkflow(args.ghlContactId, args.workflowId);
    await sb.from('reminders').update({
      status: 'sent', fired_at: new Date().toISOString(),
    }).eq('id', row.id);
    return { ok: true, reminderId: row.id };
  } catch (e: any) {
    const msg = e instanceof GhlError ? e.message : (e?.message ?? 'unknown');
    await sb.from('reminders').update({ status: 'failed', error: msg }).eq('id', row.id);
    return { ok: false, reminderId: row.id, error: msg };
  }
}

export async function fireReminder(_event: string, _row: any) {
  // Placeholder kept for symmetry with design docs.
  return null;
}

export async function sweepEmiRemindersDue(sb: AnyClient, workflowId: string | null): Promise<number> {
  const { data: rows } = await sb.from('v_emi_due_today').select('*');
  let fired = 0;
  for (const r of (rows ?? []) as any[]) {
    const dup = await sb.from('reminders').select('id')
      .eq('emi_id', r.id).in('status', ['queued', 'sent', 'delivered']).maybeSingle();
    if (dup.data) continue;
    const out = await dispatchReminder(sb, {
      event: 'emi.reminder_due',
      studentId: r.student_id,
      emiId: r.id,
      ghlContactId: r.ghl_contact_id ?? null,
      workflowId,
      payload: { amount: r.amount, due_date: r.due_date, installment: `${r.installment_no}/${r.installments_total}` },
      triggeredBy: null,
    });
    if (out.ok) fired++;
  }
  return fired;
}

export async function sweepEmiOverdue(sb: AnyClient, workflowId: string | null): Promise<number> {
  const { data: rows } = await sb.from('v_emi_overdue').select('*');
  let fired = 0;
  for (const r of (rows ?? []) as any[]) {
    const out = await dispatchReminder(sb, {
      event: 'emi.overdue',
      studentId: r.student_id,
      emiId: r.id,
      ghlContactId: r.ghl_contact_id ?? null,
      workflowId,
      payload: { amount: r.amount, due_date: r.due_date },
      triggeredBy: null,
    });
    if (out.ok) fired++;
  }
  return fired;
}

export async function sweepSilentStudents(sb: AnyClient, workflowId: string | null): Promise<number> {
  const { data: rows } = await sb.from('v_students_silent_30d').select('*');
  let fired = 0;
  for (const r of (rows ?? []) as any[]) {
    const out = await dispatchReminder(sb, {
      event: 'student.no_call_30d',
      studentId: r.id,
      ghlContactId: r.ghl_contact_id ?? null,
      workflowId,
      payload: { last_touch: r.last_touch },
      triggeredBy: null,
    });
    if (out.ok) fired++;
  }
  return fired;
}
