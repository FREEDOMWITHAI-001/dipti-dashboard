import { getRuntimeSettings } from '@/lib/settings';

// Resolve which Whisper-compatible key + endpoint to use:
//  1. Prefer a dedicated openai_api_key if the user set one explicitly
//  2. If AI provider is 'openai', reuse ai_api_key → OpenAI's Whisper
//  3. If AI provider is 'groq', reuse ai_api_key → Groq's Whisper (free tier)
//  4. Otherwise no transcription is possible
function pickWhisper(s: Awaited<ReturnType<typeof getRuntimeSettings>>): { key: string; endpoint: string; model: string } | null {
  if (s.openai) return {
    key: s.openai,
    endpoint: 'https://api.openai.com/v1/audio/transcriptions',
    model: 'whisper-1',
  };
  if (s.aiApiKey && s.aiProvider === 'openai') return {
    key: s.aiApiKey,
    endpoint: 'https://api.openai.com/v1/audio/transcriptions',
    model: 'whisper-1',
  };
  if (s.aiApiKey && s.aiProvider === 'groq') return {
    key: s.aiApiKey,
    endpoint: 'https://api.groq.com/openai/v1/audio/transcriptions',
    model: 'whisper-large-v3',
  };
  return null;
}

export async function transcribeAudio(file: File): Promise<{ text: string }> {
  const settings = await getRuntimeSettings();
  const cfg = pickWhisper(settings);
  if (!cfg) {
    return { text: '[voice transcription unavailable — pick OpenAI or Groq as your AI provider and save its key in Settings]' };
  }

  const form = new FormData();
  form.append('file', file);
  form.append('model', cfg.model);

  const res = await fetch(cfg.endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.key}` },
    body: form,
  });
  if (!res.ok) throw new Error(`whisper ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return { text: data.text ?? '' };
}