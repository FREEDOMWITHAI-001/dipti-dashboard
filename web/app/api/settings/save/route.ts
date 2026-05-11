import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// POST /api/settings/save
// body: { ghl_location_id?, ghl_pit_token?, openai_api_key?, anthropic_api_key? }
// Empty strings are ignored (so blank fields preserve existing values).
// Admin role required (also enforced by RLS on ghl_settings).
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return new NextResponse('unauthenticated', { status: 401 });

  const { data: profile } = await sb
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role !== 'admin') {
    return new NextResponse('admin only', { status: 403 });
  }

  const body = (await req.json()) as {
    ghl_location_id?: string;
    ghl_pit_token?: string;
    openai_api_key?: string;
    anthropic_api_key?: string;
  };

  const patch: Record<string, string> = {};
  if (body.ghl_location_id?.trim())   patch.location_id       = body.ghl_location_id.trim();
  if (body.ghl_pit_token?.trim())     patch.ghl_pit_token     = body.ghl_pit_token.trim();
  if (body.openai_api_key?.trim())    patch.openai_api_key    = body.openai_api_key.trim();
  if (body.anthropic_api_key?.trim()) patch.anthropic_api_key = body.anthropic_api_key.trim();

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  const admin = supabaseAdmin();
  const { error } = await admin
    .from('ghl_settings')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', 1);

  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ ok: true, updated: Object.keys(patch).length });
}
