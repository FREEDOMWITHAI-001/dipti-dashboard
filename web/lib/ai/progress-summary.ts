import Anthropic from '@anthropic-ai/sdk';
import { getRuntimeSettings } from '@/lib/settings';
 
export const PROGRESS_SYSTEM_PROMPT = `You are a coaching ops assistant. Analyse how this student is progressing
through their 6-month course and tell the coach plainly how it's going.
 
Be honest. If the student is ahead, say so. If they're slipping, say so with
the evidence (months elapsed vs months completed, call cadence, EMI status).
Cite dates and specifics. Do NOT invent facts.
 
OUTPUT MARKDOWN with these sections only:
## Where they stand
One sentence: are they on track, ahead, or behind? Quantify it (e.g.
"3 of 6 months done after 4 elapsed → 1 month behind").
 
## Momentum
2-3 bullets on recent signals: call cadence, last contact date, outcomes,
checkpoint pace. Mention which coach was last involved.
 
## Risks
Only list real concerns: long silence, overdue EMI, stalled checkpoints,
end-date approaching with months unfinished. Skip this section if none.
 
## Next coach action
1-2 concrete suggestions for the next call or reminder. Tie each to evidence.`;
 
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
 
function monthsBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const start = new Date(a).getTime();
  const end = new Date(b).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.max(0, Math.round((end - start) / (1000 * 60 * 60 * 24 * 30.44)));
}
 
function buildContext(student: Student, calls: Call[], emi: Emi[]): string {
  const monthsDone = [
    student.month_1, student.month_2, student.month_3,
    student.month_4, student.month_5, student.month_6,
  ].filter(Boolean).length;
  const progress = [
    student.month_1, student.month_2, student.month_3,
    student.month_4, student.month_5, student.month_6,
  ].map((b, i) => `M${i + 1}: ${b ? '✓' : '✗'}`).join(' · ');
 
  const today = new Date().toISOString().slice(0, 10);
  const monthsElapsed = monthsBetween(student.start_date, today);
  const monthsRemaining = monthsBetween(today, student.end_date);
  const lastCall = calls.at(-1);
  const daysSinceLastCall = lastCall
    ? Math.floor((Date.now() - new Date(lastCall.created_at).getTime()) / 86400000)
    : null;
 
  const overdue = emi.filter((e) => e.status === 'overdue').length;
  const paid = emi.filter((e) => e.status === 'paid').length;
  const upcoming = emi.find((e) => e.status === 'upcoming' || e.status === 'pending');
 
  const emiSnap = emi.length === 0 ? '(no EMI plan)' : [
    `${paid}/${emi.length} paid · ${overdue} overdue`,
    upcoming ? `Next due: ₹${upcoming.amount} on ${upcoming.due_date}` : null,
  ].filter(Boolean).join(' · ');
 
  const callLines = calls.slice(-15).map((c) =>
    `[${c.created_at.slice(0, 10)} · ${c.coach_initials}] outcome=${c.outcome ?? '?'} next=${c.next_action ?? '-'}\n  ${c.comment.replace(/\s+/g, ' ').slice(0, 300)}`
  ).join('\n');
 
  return [
    `STUDENT: ${student.first_name ?? ''} ${student.last_name ?? ''}`,
    `Membership: ${student.membership ?? '—'} · Tags: ${(student.tags ?? []).join(', ') || '—'}`,
    `Enrolled: ${student.start_date ?? '?'} → ${student.end_date ?? '?'}`,
    `Today: ${today}`,
    `Months elapsed since start: ${monthsElapsed ?? '?'}`,
    `Months remaining until end: ${monthsRemaining ?? '?'}`,
    `Course progress: ${monthsDone}/6 done · ${progress}`,
    `Background: ${student.background ?? '—'}`,
    '',
    `EMI: ${emiSnap}`,
    '',
    `Total calls logged: ${calls.length}`,
    `Last call: ${lastCall ? `${lastCall.created_at.slice(0, 10)} (${daysSinceLastCall} days ago)` : 'never'}`,
    '',
    `RECENT CALLS (last 15, oldest → newest):\n${callLines || '(no calls logged yet)'}`,
  ].join('\n');
}
 
export async function generateProgressSummary(input: {
  student: Student; calls: Call[]; emi: Emi[];
}): Promise<{ summary_md: string; model: string; tokens_in: number; tokens_out: number }> {
  const { anthropic } = await getRuntimeSettings();
 
  if (!anthropic) {
    return {
      summary_md: [
        '## Where they stand',
        '_AI summary is unavailable — set `ANTHROPIC_API_KEY` (or save it in Settings) to enable._',
      ].join('\n'),
      model: 'stub', tokens_in: 0, tokens_out: 0,
    };
  }
 
  const client = new Anthropic({ apiKey: anthropic });
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 700,
    system: PROGRESS_SYSTEM_PROMPT,
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