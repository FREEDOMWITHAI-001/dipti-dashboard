import Anthropic from '@anthropic-ai/sdk';
import { getRuntimeSettings } from '@/lib/settings';

export const BRIEFING_SYSTEM_PROMPT = `You are a coaching ops assistant. Summarize this student for the next coach
who is about to call them. Be concrete, cite call dates, and attribute themes to
the coach who introduced them. Do NOT invent facts. If something is unclear,
say so explicitly.

OUTPUT MARKDOWN with these sections only:
## Story (2–3 sentences)
## Ongoing threads (per coach, with date ranges)
## Open actions (with due dates)
## Flags (only if real concerns exist)`;

type Student = {
  first_name: string | null; last_name: string | null;
  membership: string | null; tags: string[] | null;
  start_date: string | null; end_date: string | null;
  background: string | null;
  month_1: boolean; month_2: boolean; month_3: boolean;
  month_4: boolean; month_5: boolean; month_6: boolean;
};

type Call = {
  created_at: string; comment: string;
  outcome: string | null; next_action: string | null;
  coach_initials: string;
};

type Emi = {
  installment_no: number; installments_total: number;
  amount: number; due_date: string;
  status: string; paid_date: string | null;
};

function buildContext(student: Student, calls: Call[], emi: Emi[]): string {
  const progress = [
    student.month_1, student.month_2, student.month_3,
    student.month_4, student.month_5, student.month_6,
  ].map((b, i) => `M${i + 1}: ${b ? '✓' : '✗'}`).join(' · ');

  const emiSnap = emi.map((e) =>
    `${e.installment_no}/${e.installments_total} · ₹${e.amount} · due ${e.due_date} · ${e.status}${e.paid_date ? ` (paid ${e.paid_date})` : ''}`
  ).join('\n');

  const callLines = calls.map((c) =>
    `[${c.created_at.slice(0, 10)} · ${c.coach_initials}] outcome=${c.outcome ?? '?'} next=${c.next_action ?? '-'}\n  ${c.comment.replace(/\s+/g, ' ').slice(0, 400)}`
  ).join('\n');

  return [
    `STUDENT: ${student.first_name ?? ''} ${student.last_name ?? ''}`,
    `Membership: ${student.membership ?? '—'} · Tags: ${(student.tags ?? []).join(', ') || '—'}`,
    `Enrolled: ${student.start_date ?? '?'} → ${student.end_date ?? '?'}`,
    `Progress: ${progress}`,
    `Background: ${student.background ?? '—'}`,
    '',
    `EMI:\n${emiSnap || '(none)'}`,
    '',
    `CALLS (oldest → newest):\n${callLines || '(no calls logged yet)'}`,
  ].join('\n');
}

export async function generateBriefing(input: {
  student: Student; calls: Call[]; emi: Emi[];
}): Promise<{ summary_md: string; model: string; tokens_in: number; tokens_out: number }> {
  const { anthropic } = await getRuntimeSettings();

  if (!anthropic) {
    // Graceful degradation when no key configured.
    return {
      summary_md: [
        '## Story',
        '_AI briefing is unavailable — set `ANTHROPIC_API_KEY` (or save it in Settings) to enable._',
        '',
        '## Ongoing threads',
        input.calls.length === 0
          ? '_No calls logged yet._'
          : `${input.calls.length} call(s) on file. View the timeline below.`,
      ].join('\n'),
      model: 'stub', tokens_in: 0, tokens_out: 0,
    };
  }

  const client = new Anthropic({ apiKey: anthropic });
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    system: BRIEFING_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildContext(input.student, input.calls, input.emi) }],
  });

  const summary = msg.content[0]?.type === 'text' ? msg.content[0].text : '';
  return {
    summary_md: summary,
    model: msg.model,
    tokens_in: msg.usage.input_tokens,
    tokens_out: msg.usage.output_tokens,
  };
}
