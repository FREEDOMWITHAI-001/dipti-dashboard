import { getRuntimeSettings } from '@/lib/settings';

export async function transcribeAudio(file: File): Promise<{ text: string }> {
  const { openai } = await getRuntimeSettings();
  if (!openai) {
    return { text: '[voice transcription unavailable — set OPENAI_API_KEY in Settings]' };
  }

  const form = new FormData();
  form.append('file', file);
  form.append('model', 'whisper-1');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openai}` },
    body: form,
  });
  if (!res.ok) throw new Error(`whisper ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return { text: data.text ?? '' };
}
