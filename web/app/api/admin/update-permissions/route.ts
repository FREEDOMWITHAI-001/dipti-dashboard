import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// POST /api/admin/update-permissions
// body: { user_id: string, permissions: string[] }
// Admin-only. Updates the permissions array on profiles.

const VALID_PERMS = new Set([
  'students', 'emi', 'progress', 'follow-ups',
  'reminders', 'calls', 'comments', 'reports',
]);

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return new NextResponse('unauthenticated', { status: 401 });

  // Verify caller is admin
  const { data: caller } = await sb.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (caller?.role !== 'admin') {
    return new NextResponse('forbidden — admin only', { status: 403 });
  }

  const body = await req.json() as { user_id: string; permissions: string[] };
  if (!body.user_id || !Array.isArray(body.permissions)) {
    return new NextResponse('user_id and permissions array required', { status: 400 });
  }

  // Filter to valid keys only
  const cleanPerms = body.permissions.filter((p) => VALID_PERMS.has(p));

  const admin = supabaseAdmin();
  const { error } = await admin
    .from('profiles')
    .update({ permissions: cleanPerms })
    .eq('id', body.user_id);
  if (error) return new NextResponse(error.message, { status: 500 });

  return NextResponse.json({ ok: true, permissions: cleanPerms });
}