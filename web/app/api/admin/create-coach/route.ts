import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// POST /api/admin/create-coach
// body: { email, password, display_name?, initials?, make_admin? }
// Creates a new Supabase auth user. The handle_new_user trigger then
// auto-creates a profile row with role='coach'. If make_admin is true,
// we update the new profile's role to 'admin' after creation.
// Caller must already be admin.
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return new NextResponse('unauthenticated', { status: 401 });

  const { data: callerProfile } = await sb
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (callerProfile?.role !== 'admin') {
    return new NextResponse('admin only', { status: 403 });
  }

  const body = (await req.json()) as {
    email?: string;
    password?: string;
    display_name?: string;
    initials?: string;
    make_admin?: boolean;
  };

  const email = (body.email ?? '').trim().toLowerCase();
  const password = (body.password ?? '').trim();
  const displayName = (body.display_name ?? '').trim();
  const initials = (body.initials ?? '').trim().toUpperCase().slice(0, 3);
  const makeAdmin = !!body.make_admin;

  if (!email) return new NextResponse('email required', { status: 400 });
  if (!password || password.length < 6) {
    return new NextResponse('password must be at least 6 characters', { status: 400 });
  }

  const admin = supabaseAdmin();

  // Create the auth user. email_confirm: true marks it confirmed so they can
  // sign in immediately without checking inbox.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: displayName || email.split('@')[0],
      initials: initials || email.slice(0, 2).toUpperCase(),
    },
  });

  if (createErr) {
    // Friendly message for the common case
    const msg = createErr.message || 'Failed to create user';
    if (msg.toLowerCase().includes('already')) {
      return new NextResponse('A user with that email already exists.', { status: 409 });
    }
    return new NextResponse(msg, { status: 500 });
  }
  if (!created.user) {
    return new NextResponse('User was not created', { status: 500 });
  }

  // The handle_new_user trigger should have already inserted the profile
  // with role='coach'. If make_admin was requested, update it to 'admin'.
  // Also defensive: if the trigger somehow didn't run, ensure a row exists.
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('id', created.user.id)
    .maybeSingle();

  if (!existingProfile) {
    await admin.from('profiles').insert({
      id: created.user.id,
      display_name: displayName || email.split('@')[0],
      initials: initials || email.slice(0, 2).toUpperCase(),
      role: makeAdmin ? 'admin' : 'coach',
    });
  } else if (makeAdmin) {
    await admin
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', created.user.id);
  }

  return NextResponse.json({
    ok: true,
    user_id: created.user.id,
    email,
    role: makeAdmin ? 'admin' : 'coach',
  });
}