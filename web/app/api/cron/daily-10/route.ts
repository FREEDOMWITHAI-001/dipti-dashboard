import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sweepEmiOverdue } from '@/lib/events';

// Vercel Cron 10:00 IST → UTC 04:30
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    if (req.headers.get('user-agent') !== 'vercel-cron/1.0') {
      return new NextResponse('forbidden', { status: 403 });
    }
  }

  const sb = supabaseAdmin();
  const cfg = (await sb.from('reminder_events').select('default_workflow_id, enabled').eq('id', 'emi.overdue').maybeSingle()).data;
  let fired = 0;
  if (cfg?.enabled) fired = await sweepEmiOverdue(sb, cfg.default_workflow_id ?? null);
  return NextResponse.json({ ok: true, fired });
}
