import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// POST /api/admin/promote
// body: { email }
// Promotes the user with this email to role='admin' in public.profiles.
// Caller must already be admin. The actual write uses the service-role
// client so it bypasses RLS (which restricts profile updates to self).
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return new NextResponse('unauthenticated', { status: 401 });

  // Caller must be admin
  const { data: callerProfile } = await sb
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (callerProfile?.role !== 'admin') {
    return new NextResponse('admin only', { status: 403 });
  }

  const body = (await req.json()) as { email?: string };
  const email = (body.email ?? '').trim().toLowerCase();
  if (!email) return new NextResponse('email required', { status: 400 });

  const admin = supabaseAdmin();

  // Find the auth user by email. listUsers() returns up to 50 per page by
  // default; for DVA's scale (a handful of staff), one page is plenty.
  // For very large user bases this would need pagination.
  const { data: usersPage, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listErr) return new NextResponse(listErr.message, { status: 500 });

  const target = usersPage.users.find(
    (u) => (u.email ?? '').toLowerCase() === email
  );

  if (!target) {
    return new NextResponse(
      'No user with that email. Ask them to sign in once first so their account is created.',
      { status: 404 }
    );
  }

  // Make sure they have a profile row — handle_new_user trigger normally
  // creates it on signup, but be defensive in case it didn't run.
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id, role, display_name')
    .eq('id', target.id)
    .maybeSingle();

  if (!existingProfile) {
    await admin.from('profiles').insert({
      id: target.id,
      display_name:
        (target.user_metadata as any)?.display_name ??
        (target.email ? target.email.split('@')[0] : 'User'),
      initials: (target.email ?? 'U').slice(0, 2).toUpperCase(),
      role: 'admin',
    });
    return NextResponse.json({ ok: true, alreadyAdmin: false, email });
  }

  if (existingProfile.role === 'admin') {
    return NextResponse.json({ ok: true, alreadyAdmin: true, email });
  }

  const { error: updErr } = await admin
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', target.id);

  if (updErr) return new NextResponse(updErr.message, { status: 500 });
  return NextResponse.json({ ok: true, alreadyAdmin: false, email });
}