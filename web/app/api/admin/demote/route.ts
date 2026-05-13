import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// POST /api/admin/demote
// body: { user_id: string }
// Demotes an admin to coach. Safety: can't demote self, can't demote
// the last admin.

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
    return new NextResponse("You can't demote yourself.", { status: 400 });
  }

  const admin = supabaseAdmin();

  const { data: target } = await admin
    .from('profiles')
    .select('role')
    .eq('id', body.user_id)
    .maybeSingle();
  if (!target) return new NextResponse('user not found', { status: 404 });

  if ((target as any).role !== 'admin') {
    return new NextResponse('user is not an admin', { status: 400 });
  }

  // Block demoting the last admin.
  const { count } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'admin');
  if ((count ?? 0) <= 1) {
    return new NextResponse(
      "Can't demote the last admin — promote another user first.",
      { status: 400 }
    );
  }

  const { error } = await admin
    .from('profiles')
    .update({ role: 'coach' })
    .eq('id', body.user_id);
  if (error) return new NextResponse(error.message, { status: 500 });

  return NextResponse.json({ ok: true });
}