import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// POST /api/admin/set-password
// body: { user_id, password }
// Admin-only. Sets a new password for a team member (coach or admin).
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return new NextResponse('unauthenticated', { status: 401 });

  // Caller must be an admin (verified via the user-scoped client, not the
  // service-role client, so a coach can't call this).
  const { data: callerProfile } = await sb
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (callerProfile?.role !== 'admin') {
    return new NextResponse('admin only', { status: 403 });
  }

  const { user_id, password } = (await req.json()) as { user_id?: string; password?: string };
  if (!user_id) return new NextResponse('user_id required', { status: 400 });
  const pw = (password ?? '').trim();
  if (pw.length < 6) {
    return new NextResponse('password must be at least 6 characters', { status: 400 });
  }

  const admin = supabaseAdmin();
  const { error } = await admin.auth.admin.updateUserById(user_id, { password: pw });
  if (error) return new NextResponse(error.message, { status: 500 });

  return NextResponse.json({ ok: true });
}
