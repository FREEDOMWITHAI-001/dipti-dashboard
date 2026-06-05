import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getMyPermissions } from '@/lib/check-permission';

// POST /api/students/delete
// body: { ids: string[] }
// Soft-deletes one or more students (sets deleted_at). Gated: admins always, or
// coaches granted the 'delete-students' permission. Soft delete keeps payment
// history/records and avoids any cascade; rows can be restored by clearing
// deleted_at.
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { isSignedIn, isAdmin, has } = await getMyPermissions();
  if (!isSignedIn) return new NextResponse('unauthenticated', { status: 401 });
  if (!(isAdmin || has('delete-students'))) {
    return new NextResponse('forbidden — delete-students permission required', { status: 403 });
  }

  const { ids } = (await req.json()) as { ids?: string[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    return new NextResponse('ids required', { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from('students')
    .update({ deleted_at: new Date().toISOString() } as any)
    .in('id', ids)
    .is('deleted_at', null)
    .select('id');
  if (error) return new NextResponse(error.message, { status: 500 });

  return NextResponse.json({ ok: true, count: data?.length ?? 0 });
}
