import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { getRuntimeSettings } from '@/lib/settings';
import Anthropic from '@anthropic-ai/sdk';

// POST /api/chat-extract
// body: { imageBase64: string, mimeType: 'image/png' | 'image/jpeg' }
// Uses the configured vision AI (Gemini / Claude / OpenAI) to OCR a
// WhatsApp/SMS chat screenshot and return the conversation as text.

export const runtime = 'nodejs';
export const maxDuration = 60;

const SYSTEM_PROMPT = `You are extracting a conversation from a chat screenshot (WhatsApp, SMS, or similar messaging app).

Extract the conversation in this exact format:

[Coach]: <what the coach said>
[Student]: <what the student said>
[Coach]: <next message>
...

Rules:
- Identify who is the coach (usually the sender) and who is the student
- Preserve the order of messages exactly as they appear
- Skip timestamps, read receipts, emojis-only messages
- If unclear who said what, use [Person A] / [Person B]
- Keep messages concise — strip filler like "ok ok ok" repeated
- Do NOT invent or guess content not in the image
- If image doesn't contain a chat, respond with: "No chat conversation found in this image."`;

export async function POST(req: Request) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return new NextResponse('unauthenticated', { status: 401 });

  const { imageBase64, mimeType } = (await req.json()) as {
    imageBase64: string;
    mimeType: string;
  };
  if (!imageBase64) return new NextResponse('imageBase64 required', { status: 400 });

  const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
  const cleanMime = mimeType || 'image/jpeg';

  const { aiProvider, aiApiKey, anthropic } = await getRuntimeSettings();

  try {
    let extractedText = '';

    if (aiProvider === 'google' && aiApiKey) {
      extractedText = await callGeminiVision(cleanBase64, cleanMime, aiApiKey);
    } else if (aiProvider === 'anthropic' && anthropic) {
      extractedText = await callClaudeVision(cleanBase64, cleanMime, anthropic);
    } else if (aiProvider === 'openai' && aiApiKey) {
      extractedText = await callOpenAIVision(cleanBase64, cleanMime, aiApiKey);
    } else if (aiProvider === 'groq') {
      return new NextResponse(
        'Groq does not support image analysis. Switch to Gemini, Claude, or OpenAI in Settings → AI assistant for chat screenshot extraction.',
        { status: 400 }
      );
    } else {
      return new NextResponse(
        'No vision-capable AI provider configured. Set up Gemini, Claude, or OpenAI in Settings → AI assistant.',
        { status: 400 }
      );
    }

    if (!extractedText || !extractedText.trim()) {
      return new NextResponse('AI returned empty response. Try a clearer screenshot.', { status: 500 });
    }

    return NextResponse.json({ text: extractedText.trim() });
  } catch (e: any) {
    return new NextResponse(e.message ?? 'Extraction failed', { status: 500 });
  }
}

async function callGeminiVision(base64: string, mimeType: string, apiKey: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{
        role: 'user',
        parts: [
          { inline_data: { mime_type: mimeType, data: base64 } },
          { text: 'Extract the chat conversation from this screenshot.' },
        ],
      }],
      generationConfig: { maxOutputTokens: 2000, temperature: 0.2 },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

async function callClaudeVision(base64: string, mimeType: string, apiKey: string): Promise<string> {
  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mimeType as any, data: base64 } },
        { type: 'text', text: 'Extract the chat conversation from this screenshot.' },
      ],
    }],
  });
  return msg.content[0]?.type === 'text' ? msg.content[0].text : '';
}

async function callOpenAIVision(base64: string, mimeType: string, apiKey: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 2000,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract the chat conversation from this screenshot.' },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? '';
}