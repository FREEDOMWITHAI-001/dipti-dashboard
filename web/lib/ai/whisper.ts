import { getRuntimeSettings } from '@/lib/settings';

// Voice transcription with multi-provider support:
//   - OpenAI Whisper       (provider='openai')
//   - Groq Whisper         (provider='groq', fast + free)
//   - Google Gemini audio  (provider='google', uses generateContent API)
//
// Anthropic Claude and OpenRouter don't have a direct audio transcription API,
// so for those providers voice falls back to "unavailable".

export async function transcribeAudio(file: File): Promise<{ text: string }> {
  const settings = await getRuntimeSettings();

  // 1. Dedicated OpenAI key trumps everything (legacy support)
  if (settings.openai) {
    return whisperOpenAICompatible(file, settings.openai, 'https://api.openai.com/v1/audio/transcriptions', 'whisper-1');
  }

  // 2. Route based on the configured AI provider
  if (settings.aiApiKey) {
    if (settings.aiProvider === 'openai') {
      return whisperOpenAICompatible(file, settings.aiApiKey, 'https://api.openai.com/v1/audio/transcriptions', 'whisper-1');
    }
    if (settings.aiProvider === 'groq') {
      return whisperOpenAICompatible(file, settings.aiApiKey, 'https://api.groq.com/openai/v1/audio/transcriptions', 'whisper-large-v3');
    }
    if (settings.aiProvider === 'google') {
      return transcribeViaGemini(file, settings.aiApiKey);
    }
  }

  return {
    text: '[voice transcription unavailable — pick OpenAI, Groq, or Google Gemini as your AI provider in Settings → AI assistant]',
  };
}

// OpenAI / Groq use the same multipart upload format.
async function whisperOpenAICompatible(file: File, apiKey: string, endpoint: string, model: string): Promise<{ text: string }> {
  const form = new FormData();
  form.append('file', file);
  form.append('model', model);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(`whisper ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return { text: data.text ?? '' };
}

// Gemini transcribes via its standard generateContent API with inline_data
// containing the audio. Costs against the same Gemini free tier as text calls.
async function transcribeViaGemini(file: File, apiKey: string): Promise<{ text: string }> {
  // Convert file to base64
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);

  // Gemini accepts these audio MIME types: audio/wav, audio/mp3, audio/aiff,
  // audio/aac, audio/ogg, audio/flac, audio/webm, audio/mp4.
  // Browser MediaRecorder usually produces audio/webm — works directly.
  const mimeType = file.type || 'audio/webm';

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [
          { inline_data: { mime_type: mimeType, data: base64 } },
          { text: 'Transcribe this audio recording verbatim. Output only the transcribed text in the language spoken, nothing else. Do not add any prefix, suffix, or commentary.' },
        ],
      }],
      generationConfig: { maxOutputTokens: 2000, temperature: 0.0 },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Gemini transcription ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return { text: text.trim() };
}