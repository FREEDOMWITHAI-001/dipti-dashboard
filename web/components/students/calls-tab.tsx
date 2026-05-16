'use client';
 
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CornerDownLeft, CalendarPlus, X, ImagePlus, Loader2 } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useToast } from '@/components/shell/toast-region';
import { CoachAvatar } from '@/components/ui/avatar';
import { fmtDate, cn } from '@/lib/utils';
import { BriefingCard } from './briefing-card';
import { VoiceButton } from './voice-button';
import type { Database } from '@/types/database';
 
type Call = Database['public']['Tables']['call_logs']['Row'] & { coach?: { display_name: string; initials: string } };
 
// Helper: yyyy-mm-dd from a Date, in local time.
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
 
function presetDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return ymd(d);
}
 
export function CallsTab({ studentId }: { studentId: string }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const { toast } = useToast();
  const [calls, setCalls] = useState<Call[]>([]);
  const [comment, setComment] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [outcome, setOutcome] = useState<Call['outcome']>(null);
  const [saving, setSaving] = useState(false);
  const [presence, setPresence] = useState<string[]>([]);
 
  // Next-action picker state
  const [nextOpen, setNextOpen] = useState(false);
  const [nextAction, setNextAction] = useState('');
  const [nextDue, setNextDue] = useState('');
 
  // load calls
  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await sb
        .from('call_logs')
        .select('*, coach:profiles(display_name, initials)')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });
      if (!cancel) setCalls((data ?? []) as Call[]);
    })();
    return () => { cancel = true; };
  }, [studentId, sb]);
 
  // realtime + presence
  useEffect(() => {
    // Defensive: tear down any stale channel with this topic
    // (handles React Strict Mode double-mount and dev hot-reload)
    const topic = `realtime:student:${studentId}`;
    sb.getChannels().forEach((c) => {
      if (c.topic === topic) sb.removeChannel(c);
    });
 
    // Chain .on() → .subscribe() synchronously. No async work between
    // creating the channel and subscribing, or Supabase will throw
    // "cannot add postgres_changes callbacks ... after subscribe()".
    const ch = sb
      .channel(`student:${studentId}`, { config: { presence: { key: studentId } } })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'call_logs', filter: `student_id=eq.${studentId}` },
        async () => {
          const { data } = await sb
            .from('call_logs')
            .select('*, coach:profiles(display_name, initials)')
            .eq('student_id', studentId)
            .order('created_at', { ascending: false });
          setCalls((data ?? []) as Call[]);
        }
      )
      .on('presence', { event: 'sync' }, () => {
        const state = ch.presenceState();
        const initials = Object.values(state).flat().map((p: any) => p.initials).filter(Boolean);
        setPresence(initials);
      })
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED') return;
        const { data: { user } } = await sb.auth.getUser();
        if (!user) return;
        const { data: prof } = await sb.from('profiles').select('initials').eq('id', user.id).maybeSingle();
        await ch.track({ initials: prof?.initials ?? 'U', ts: Date.now() });
      });
 
    return () => { sb.removeChannel(ch); };
  }, [studentId, sb]);
 
  async function save() {
    if (!comment.trim()) return;
    setSaving(true);
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { toast('Not signed in', 'error'); setSaving(false); return; }
    const { error } = await sb.from('call_logs').insert({
      student_id: studentId,
      coach_id: user.id,
      comment,
      outcome: outcome ?? null,
      next_action: nextAction.trim() || null,
      next_action_due: nextDue || null,
    });
    setSaving(false);
    if (error) { toast(error.message, 'error'); return; }

    // Immediately refetch so AI briefing auto-regenerates.
    const { data: fresh } = await sb
      .from('call_logs')
      .select('*, coach:profiles(display_name, initials)')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });
    setCalls((fresh ?? []) as Call[]);

    setComment('');
    setOutcome(null);
    setNextAction('');
    setNextDue('');
    setNextOpen(false);
    toast('Call logged · AI briefing updating…', 'success');
  }

  async function extractChat(file: File) {
    setExtracting(true);
    try {
      const reader = new FileReader();
      const dataUrl: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch('/api/chat-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: dataUrl,
          mimeType: file.type || 'image/jpeg',
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || 'Extraction failed');
      }
      const { text } = await res.json();
      setComment((c) =>
        (c ? c + '\n\n--- From chat screenshot ---\n' : '--- From chat screenshot ---\n') + text
      );
      toast('Chat extracted · review and Save', 'success');
    } catch (e: any) {
      toast(e.message ?? 'Failed to extract chat', 'error');
    }
    setExtracting(false);
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          extractChat(file);
          return;
        }
      }
    }
  }
 
  // Label that summarises what's set in the next-action picker
  const nextLabel = (() => {
    if (!nextAction && !nextDue) return 'Next action';
    if (nextAction && nextDue) {
      const today = ymd(new Date());
      const tomorrow = presetDate(1);
      const shortDate =
        nextDue === today ? 'Today'
        : nextDue === tomorrow ? 'Tomorrow'
        : nextDue;
      return `${nextAction.length > 24 ? nextAction.slice(0, 22) + '…' : nextAction} · ${shortDate}`;
    }
    return nextAction || nextDue;
  })();
 
  const nextIsSet = !!(nextAction || nextDue);
 
  return (
    <div>
      {presence.length > 1 && (
        <div className="mb-4 flex items-center gap-2 text-[11.5px] text-ink-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-presence-pulse" />
          {presence.filter((i, idx, arr) => arr.indexOf(i) === idx).join(', ')} viewing
        </div>
      )}
 
      <BriefingCard studentId={studentId} callsCount={calls.length} />
 
      <div className="bg-white border border-ink-200/70 rounded-2xl p-5 mb-6">
        <div className="text-[12px] uppercase tracking-wider font-semibold text-ink-500 mb-2.5">Log a call</div>
        <textarea
          rows={3}
          value={comment} onChange={(e) => setComment(e.target.value)} onPaste={handlePaste}
          placeholder="How did the call go?"
          className="w-full text-[13.5px] leading-relaxed outline-none resize-none placeholder:text-ink-400"
        />
        <div className="flex items-center gap-2 mt-2 pt-3 border-t border-ink-100">
          <select
            value={outcome ?? ''} onChange={(e) => setOutcome((e.target.value || null) as Call['outcome'])}
            className="h-8 px-2.5 rounded-md border border-ink-200 text-[12px] font-medium bg-white"
          >
            <option value="">Outcome…</option>
            <option value="connected">Connected</option>
            <option value="no_answer">No answer</option>
            <option value="rescheduled">Rescheduled</option>
            <option value="wrong_number">Wrong number</option>
          </select>
 
          <button
            type="button"
            onClick={() => setNextOpen((o) => !o)}
            className={cn(
              'h-8 px-2.5 rounded-md border text-[12px] font-medium flex items-center gap-1 max-w-[260px] truncate',
              nextIsSet
                ? 'border-accent-200 bg-accent-50 text-accent-700 hover:bg-accent-100'
                : 'border-ink-200 hover:bg-ink-50'
            )}
            title={nextIsSet ? `${nextAction || '(no description)'} · ${nextDue || '(no date)'}` : 'Set a follow-up'}
          >
            <CalendarPlus className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{nextLabel}</span>
          </button>
 
          <VoiceButton onTranscript={(text) => setComment((c) => (c ? c + '\n\n' : '') + text)} />
          <label className="h-8 px-2.5 rounded-md text-[11.5px] font-medium border border-ink-200 hover:bg-ink-50 flex items-center gap-1 cursor-pointer">
            {extracting ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImagePlus className="w-3 h-3" />}
            {extracting ? 'Reading…' : 'Paste chat'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={extracting}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) extractChat(f); e.target.value = ''; }}
            />
          </label>
          <button
            disabled={saving || !comment.trim()} onClick={save}
            className="ml-auto btn-primary h-8 px-3 rounded-md text-[12px] font-medium flex items-center gap-1.5 disabled:opacity-50"
          >
            {saving ? 'Saving…' : <>Save call <CornerDownLeft className="w-3.5 h-3.5" /></>}
          </button>
        </div>
 
        {/* Inline next-action picker */}
        {nextOpen && (
          <div className="mt-3 pt-3 border-t border-ink-100 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-ink-500">
                Next action
              </div>
              <button
                type="button"
                onClick={() => {
                  setNextAction('');
                  setNextDue('');
                  setNextOpen(false);
                }}
                className="text-[11px] text-ink-500 hover:text-ink-800 flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            </div>
 
            <input
              type="text"
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              placeholder="e.g. Follow up on EMI 3 payment"
              className="w-full h-9 px-3 rounded-md border border-ink-200 text-[13px] focus:border-accent-400 focus:ring-2 focus:ring-accent-100 outline-none"
            />
 
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11.5px] text-ink-500">Due</span>
              <input
                type="date"
                value={nextDue}
                onChange={(e) => setNextDue(e.target.value)}
                min={ymd(new Date())}
                className="h-8 px-2 rounded-md border border-ink-200 text-[12px] bg-white"
              />
              <span className="text-ink-300 text-[12px]">·</span>
              <button type="button" onClick={() => setNextDue(presetDate(1))}
                className="h-7 px-2 rounded-md border border-ink-200 text-[11.5px] hover:bg-ink-50">
                Tomorrow
              </button>
              <button type="button" onClick={() => setNextDue(presetDate(3))}
                className="h-7 px-2 rounded-md border border-ink-200 text-[11.5px] hover:bg-ink-50">
                In 3 days
              </button>
              <button type="button" onClick={() => setNextDue(presetDate(7))}
                className="h-7 px-2 rounded-md border border-ink-200 text-[11.5px] hover:bg-ink-50">
                Next week
              </button>
            </div>
 
            <p className="text-[11px] text-ink-400">
              Saved together with this call when you click <span className="font-medium text-ink-600">Save call</span>.
            </p>
          </div>
        )}
      </div>
 
      <div className="text-[10.5px] uppercase tracking-wider font-semibold text-ink-500 mb-3">
        Timeline · {calls.length}
      </div>
      <div className="relative pl-6">
        <div className="absolute left-2.5 top-2 bottom-2 w-px bg-ink-200" />
        {calls.map((c) => (
          <div key={c.id} className="relative pb-5 last:pb-0">
            <div className={cn(
              'absolute -left-[14px] top-1.5 w-2.5 h-2.5 rounded-full ring-4 ring-white',
              c.outcome === 'connected' ? 'bg-emerald-500' :
              c.outcome === 'no_answer' ? 'bg-rose-400' :
              'bg-ink-300'
            )} />
            <div className="bg-white border border-ink-200/70 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <CoachAvatar initials={c.coach?.initials ?? 'U'} size={24} />
                <div className="text-[13px] font-medium">{c.coach?.display_name ?? 'Unknown'}</div>
                <div className="text-[11.5px] text-ink-500">{fmtDate(c.created_at)}</div>
                {c.outcome && (
                  <span className={cn(
                    'ml-auto text-[10.5px] font-medium px-2 py-0.5 rounded-full ring-1 ring-inset',
                    c.outcome === 'connected' ? 'bg-emerald-50 text-emerald-700 ring-emerald-100' :
                    c.outcome === 'no_answer' ? 'bg-rose-50 text-rose-700 ring-rose-100' :
                    'bg-ink-100 text-ink-600 ring-ink-200'
                  )}>
                    {c.outcome.replace('_', ' ')}
                  </span>
                )}
              </div>
              <div className="text-[13px] leading-relaxed text-ink-800 whitespace-pre-wrap">{c.comment}</div>
              {c.next_action && (
                <div className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] font-medium text-ink-700 bg-ink-50 px-2 py-1 rounded-md">
                  <ArrowRight className="w-3 h-3" />
                  {c.next_action}
                  {c.next_action_due && (
                    <span className="text-ink-500 font-normal">· due {c.next_action_due}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {calls.length === 0 && (
          <div className="text-[13px] text-ink-400 py-6">No calls logged yet. Use the composer above.</div>
        )}
      </div>
    </div>
  );
}