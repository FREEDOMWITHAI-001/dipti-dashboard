import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { transcribeAudio } from '@/lib/ai/whisper';

// POST /api/voice/transcribe — multipart with `audio` file
export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: Request) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return new NextResponse('unauthenticated', { status: 401 });

  const form = await req.formData();
  const file = form.get('audio') as File | null;
  if (!file) return new NextResponse('audio required', { status: 400 });
  if (file.size > 5_000_000) return new NextResponse('audio too large (max 5MB)', { status: 413 });

  try {
    const { text } = await transcribeAudio(file);
    return NextResponse.json({ text });
  } catch (e: any) {
    return new NextResponse(e.message ?? 'transcription failed', { status: 500 });
  }
}
