'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CornerDownLeft, CalendarPlus } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useToast } from '@/components/shell/toast-region';
import { CoachAvatar } from '@/components/ui/avatar';
import { fmtDate, cn } from '@/lib/utils';
import { BriefingCard } from './briefing-card';
import { VoiceButton } from './voice-button';
import type { Database } from '@/types/database';

type Call = Database['public']['Tables']['call_logs']['Row'] & { coach?: { display_name: string; initials: string } };

export function CallsTab({ studentId }: { studentId: string }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const { toast } = useToast();
  const [calls, setCalls] = useState<Call[]>([]);
  const [comment, setComment] = useState('');
  const [outcome, setOutcome] = useState<Call['outcome']>(null);
  const [saving, setSaving] = useState(false);
  const [presence, setPresence] = useState<string[]>([]);

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
    const ch = sb.channel(`student:${studentId}`, { config: { presence: { key: studentId } } });

    ch.on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'call_logs', filter: `student_id=eq.${studentId}` },
        async () => {
          const { data } = await sb.from('call_logs').select('*, coach:profiles(display_name, initials)').eq('student_id', studentId).order('created_at', { ascending: false });
          setCalls((data ?? []) as Call[]);
        });

    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState();
      const initials = Object.values(state).flat().map((p: any) => p.initials).filter(Boolean);
      setPresence(initials);
    });

    (async () => {
      const { data: { user } } = await sb.auth.getUser();
      if (user) {
        const { data: prof } = await sb.from('profiles').select('initials').eq('id', user.id).maybeSingle();
        await ch.subscribe(async (status) => {
          if (status === 'SUBSCRIBED') await ch.track({ initials: prof?.initials ?? 'U', ts: Date.now() });
        });
      } else {
        await ch.subscribe();
      }
    })();

    return () => { sb.removeChannel(ch); };
  }, [studentId, sb]);

  async function save() {
    if (!comment.trim()) return;
    setSaving(true);
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { toast('Not signed in', 'error'); setSaving(false); return; }
    const { error } = await sb.from('call_logs').insert({
      student_id: studentId, coach_id: user.id, comment, outcome: outcome ?? null,
    });
    setSaving(false);
    if (error) { toast(error.message, 'error'); return; }
    setComment(''); setOutcome(null);
    toast('Call logged', 'success');
  }

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
          value={comment} onChange={(e) => setComment(e.target.value)}
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
            onClick={() => toast('Inline next-action picker coming soon — for now, mention the follow-up date in the call note.', 'info')}
            className="h-8 px-2.5 rounded-md border border-ink-200 text-[12px] font-medium hover:bg-ink-50 flex items-center gap-1"
          >
            <CalendarPlus className="w-3.5 h-3.5" /> Next action
          </button>
          <VoiceButton onTranscript={(text) => setComment((c) => (c ? c + '\n\n' : '') + text)} />
          <button
            disabled={saving || !comment.trim()} onClick={save}
            className="ml-auto btn-primary h-8 px-3 rounded-md text-[12px] font-medium flex items-center gap-1.5 disabled:opacity-50"
          >
            {saving ? 'Saving…' : <>Save call <CornerDownLeft className="w-3.5 h-3.5" /></>}
          </button>
        </div>
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
                  <ArrowRight className="w-3 h-3" /> {c.next_action}
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
