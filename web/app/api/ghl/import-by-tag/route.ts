import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { ghlSearchContactsByTag } from '@/lib/ghl/client';

// POST /api/ghl/import-by-tag
// body: { tag: string }
// Paginates through GHL contacts with the given tag and upserts them into students.

export async function POST(req: Request) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return new NextResponse('unauthenticated', { status: 401 });

  const { tag } = (await req.json()) as { tag: string };
  if (!tag) return new NextResponse('tag required', { status: 400 });

  const admin = supabaseAdmin();
  let imported = 0, updated = 0, startAfterId: string | undefined;

  try {
    while (true) {
      const page = await ghlSearchContactsByTag(tag, 100, startAfterId);
      const contacts = page.contacts ?? [];
      if (!contacts.length) break;

      for (const c of contacts) {
        if (!c.email) continue;
        const { data: existing } = await admin.from('students').select('id').eq('email', c.email.toLowerCase()).maybeSingle();
        const payload = {
          ghl_contact_id: c.id,
          email: c.email.toLowerCase(),
          first_name: c.firstName ?? null,
          last_name: c.lastName ?? null,
          mobile: c.phone ?? null,
          tags: c.tags ?? [],
        };
        if (existing) {
          await admin.from('students').update(payload).eq('id', existing.id);
          updated++;
        } else {
          await admin.from('students').insert(payload);
          imported++;
        }
      }

      startAfterId = page.meta?.startAfterId ?? page.contacts[page.contacts.length - 1]?.id;
      if (!startAfterId || contacts.length < 100) break;
    }

    await admin.from('ghl_settings').update({ last_full_sync: new Date().toISOString() }).eq('id', 1);
    return NextResponse.json({ ok: true, imported, updated });
  } catch (e: any) {
    return new NextResponse(e.message ?? 'import failed', { status: 500 });
  }
}
