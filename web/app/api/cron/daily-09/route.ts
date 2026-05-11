import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sweepEmiRemindersDue, sweepSilentStudents } from '@/lib/events';

// Vercel Cron 09:00 IST  → UTC 03:30
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: Request) {
  // Vercel cron provides a header; alternatively rely on CRON_SECRET in querystring
  const auth = req.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    if (req.headers.get('user-agent') !== 'vercel-cron/1.0') {
      return new NextResponse('forbidden', { status: 403 });
    }
  }

  const sb = supabaseAdmin();
  await sb.rpc('refresh_emi_statuses' as any);

  const wf = async (id: string) => (await sb.from('reminder_events').select('default_workflow_id, enabled').eq('id', id).maybeSingle()).data;

  const emiCfg     = await wf('emi.reminder_due');
  const silentCfg  = await wf('student.no_call_30d');

  let fired = 0;
  if (emiCfg?.enabled)    fired += await sweepEmiRemindersDue(sb, emiCfg.default_workflow_id ?? null);
  if (silentCfg?.enabled) fired += await sweepSilentStudents(sb, silentCfg.default_workflow_id ?? null);

  return NextResponse.json({ ok: true, fired });
}
