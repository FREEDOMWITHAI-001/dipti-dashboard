import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// Vercel Cron — last days of month, 23:55 IST → UTC 18:25
// Fires `course.month_pending` for students whose current month checkbox is not yet ticked.
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    if (req.headers.get('user-agent') !== 'vercel-cron/1.0') {
      return new NextResponse('forbidden', { status: 403 });
    }
  }

  // Only fire on the actual last day of the month
  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  if (today.getMonth() === tomorrow.getMonth()) return NextResponse.json({ ok: true, fired: 0, reason: 'not last day' });

  const sb = supabaseAdmin();
  const cfg = (await sb.from('reminder_events').select('default_workflow_id, enabled').eq('id', 'course.month_pending').maybeSingle()).data;
  if (!cfg?.enabled) return NextResponse.json({ ok: true, fired: 0, reason: 'disabled' });

  // Stub: implementation iterates students and computes which monthN matches their progress
  // and fires GHL workflow if unticked. For brevity left as a TODO in v1 buildout.
  return NextResponse.json({ ok: true, fired: 0, note: 'month_pending logic pending v1 wiring' });
}
