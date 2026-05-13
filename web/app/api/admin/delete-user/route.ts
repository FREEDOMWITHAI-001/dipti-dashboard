import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// POST /api/admin/delete-user
// body: { user_id: string }
// Permanently deletes a user from auth.users (cascades to profiles).
// Safety: can't delete self, can't delete the last admin.

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return new NextResponse('unauthenticated', { status: 401 });

  const { data: caller } = await sb
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if ((caller as any)?.role !== 'admin') {
    return new NextResponse('admin only', { status: 403 });
  }

  const body = (await req.json()) as { user_id?: string };
  if (!body.user_id) return new NextResponse('user_id required', { status: 400 });

  if (body.user_id === user.id) {
    return new NextResponse("You can't delete your own account.", { status: 400 });
  }

  const admin = supabaseAdmin();

  // Look up target's role before deleting so we can check the last-admin rule.
  const { data: target } = await admin
    .from('profiles')
    .select('role, display_name')
    .eq('id', body.user_id)
    .maybeSingle();
  if (!target) return new NextResponse('user not found', { status: 404 });

  if ((target as any).role === 'admin') {
    const { count } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin');
    if ((count ?? 0) <= 1) {
      return new NextResponse(
        "Can't delete the last admin — promote another user first.",
        { status: 400 }
      );
    }
  }

  // Delete from auth (this should cascade to profiles via FK).
  const { error: delErr } = await admin.auth.admin.deleteUser(body.user_id);
  if (delErr) return new NextResponse(`Auth delete failed: ${delErr.message}`, { status: 500 });

  // Belt-and-suspenders: also remove the profile row in case the FK doesn't cascade.
  await admin.from('profiles').delete().eq('id', body.user_id);

  return NextResponse.json({ ok: true });
}