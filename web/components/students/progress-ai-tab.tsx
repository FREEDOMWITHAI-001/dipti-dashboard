'use client';
 
import { useEffect, useState } from 'react';
import { Sparkles, RefreshCw, Copy, Info } from 'lucide-react';
import { useToast } from '@/components/shell/toast-region';
import { cn } from '@/lib/utils';
 
type State = {
  summary_md: string;
  source_calls_count: number;
  generated_at: string;
};
 
export function ProgressAiTab({ studentId }: { studentId: string }) {
  const { toast } = useToast();
  const [state, setState] = useState<State | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
 
  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/progress-summary/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId }),
      });
      if (!r.ok) throw new Error(await r.text());
      const d = await r.json();
      setState({
        summary_md: d.summary_md,
        source_calls_count: d.source_calls_count,
        generated_at: d.generated_at,
      });
    } catch (e: any) {
      const msg = e.message ?? 'Failed to generate summary';
      setError(msg);
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }
 
  // Auto-generate on first mount.
  useEffect(() => {
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);
 
  return (
    <div className="briefing-card rounded-2xl p-6 relative overflow-hidden">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-accent-50 grid place-items-center">
            <Sparkles className="w-[18px] h-[18px] text-accent-600" />
          </div>
          <div>
            <div className="font-semibold text-[14px] tracking-tight">Progress AI Summary</div>
            <div className="text-[11.5px] text-ink-500">
              {state
                ? `Based on ${state.source_calls_count} call${state.source_calls_count === 1 ? '' : 's'} + checkpoints + EMI`
                : loading ? 'Analysing trajectory…' : 'Click regenerate to start'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={generate}
            disabled={loading}
            className="h-7 w-7 rounded-md hover:bg-ink-100 grid place-items-center disabled:opacity-50"
            title="Regenerate"
          >
            <RefreshCw className={cn('w-3.5 h-3.5 text-ink-500', loading && 'animate-spin')} />
          </button>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(state?.summary_md ?? '');
              toast('Copied', 'success');
            }}
            disabled={!state}
            className="h-7 w-7 rounded-md hover:bg-ink-100 grid place-items-center disabled:opacity-50"
            title="Copy"
          >
            <Copy className="w-3.5 h-3.5 text-ink-500" />
          </button>
        </div>
      </div>
 
      {loading && !state ? (
        <SummarySkeleton />
      ) : error && !state ? (
        <div className="text-[13px] text-rose-700 bg-rose-50 border border-rose-100 rounded-lg p-3">
          Couldn't generate the summary. Try Regenerate.
        </div>
      ) : (
        <>
          <article className="prose-briefing text-[13.5px] leading-relaxed text-ink-800">
            <RenderMarkdown md={state?.summary_md ?? ''} />
          </article>
          <div className="mt-5 pt-4 border-t border-ink-100/80 flex items-center gap-2 text-[11px] text-ink-400">
            <Info className="w-3.5 h-3.5" />
            AI-generated · verify before quoting · powered by Claude Haiku
          </div>
        </>
      )}
    </div>
  );
}
 
function SummarySkeleton() {
  return (
    <div className="space-y-3">
      <div className="skeleton h-3 w-1/3" />
      <div className="skeleton h-3 w-3/4" />
      <div className="briefing-divider h-px my-4" />
      <div className="skeleton h-3 w-1/4" />
      <div className="skeleton h-3 w-5/6" />
      <div className="skeleton h-3 w-2/3" />
      <div className="briefing-divider h-px my-4" />
      <div className="skeleton h-3 w-1/3" />
      <div className="skeleton h-3 w-3/4" />
    </div>
  );
}
 
// Light markdown renderer — same approach as BriefingCard.
// Handles ## headings, - bullets, and paragraphs.
function RenderMarkdown({ md }: { md: string }) {
  const blocks: Array<{ type: 'h2' | 'p' | 'ul'; content: string | string[] }> = [];
  let currentList: string[] | null = null;
 
  md.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      if (currentList) { blocks.push({ type: 'ul', content: currentList }); currentList = null; }
      return;
    }
    if (trimmed.startsWith('## ')) {
      if (currentList) { blocks.push({ type: 'ul', content: currentList }); currentList = null; }
      blocks.push({ type: 'h2', content: trimmed.slice(3) });
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      currentList ??= [];
      currentList.push(trimmed.slice(2));
    } else {
      if (currentList) { blocks.push({ type: 'ul', content: currentList }); currentList = null; }
      blocks.push({ type: 'p', content: trimmed });
    }
  });
  if (currentList) blocks.push({ type: 'ul', content: currentList });
 
  return (
    <div className="space-y-3">
      {blocks.map((b, i) => {
        if (b.type === 'h2') {
          return (
            <h3 key={i} className="text-[10.5px] uppercase tracking-wider font-semibold text-ink-500 mt-4 first:mt-0">
              {b.content as string}
            </h3>
          );
        }
        if (b.type === 'ul') {
          return (
            <ul key={i} className="space-y-1.5 list-disc list-inside marker:text-ink-300">
              {(b.content as string[]).map((item, j) => (
                <li key={j} className="text-[13px] text-ink-800 leading-snug">{item}</li>
              ))}
            </ul>
          );
        }
        return <p key={i} className="text-[13.5px] text-ink-800 leading-relaxed">{b.content as string}</p>;
      })}
    </div>
  );
}