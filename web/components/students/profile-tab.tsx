'use client';

import { useState } from 'react';
import { Pencil, Mic } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { fmtDate } from '@/lib/utils';
import { VoiceButton } from './voice-button';
import { useToast } from '@/components/shell/toast-region';
import type { Database } from '@/types/database';

type Student = Database['public']['Tables']['students']['Row'];

export function ProfileTab({ student }: { student: Student }) {
  const sb = supabaseBrowser();
  const { toast } = useToast();
  const [bg, setBg] = useState(student.background ?? '');
  const [editing, setEditing] = useState(false);

  async function save() {
    const { error } = await sb.from('students').update({ background: bg }).eq('id', student.id);
    if (error) { toast(error.message, 'error'); return; }
    toast('Saved', 'success');
    setEditing(false);
  }

  return (
    <div className="space-y-7">
      <Section title="Identity">
        <Field label="First name" value={student.first_name ?? '—'} />
        <Field label="Last name" value={student.last_name ?? '—'} />
        <Field label="Email" value={student.email} />
        <Field label="Mobile" value={student.mobile ?? '—'} />
      </Section>

      <Section title="Program">
        <Field label="Membership" value={<span className="font-medium">{student.membership ?? '—'}</span>} />
        <Field label="Tags" value={student.tags?.length
          ? <>{student.tags.map((t) => <span key={t} className="text-[10.5px] font-medium px-1.5 py-0.5 rounded bg-ink-100 text-ink-700 mr-1">{t}</span>)}</>
          : <span className="text-ink-400">none</span>} />
        <Field label="Start date" value={fmtDate(student.start_date)} />
        <Field label="End date" value={fmtDate(student.end_date)} />
      </Section>

      <div>
        <h3 className="text-[12px] uppercase tracking-wider text-ink-500 font-semibold mb-2">Background</h3>
        <div className="bg-white border border-ink-200/70 rounded-xl p-5">
          {editing ? (
            <textarea
              value={bg} onChange={(e) => setBg(e.target.value)}
              rows={4}
              className="w-full text-[13.5px] leading-relaxed outline-none resize-none placeholder:text-ink-400"
              placeholder="What's the student's story?"
            />
          ) : (
            <div className="text-[13.5px] leading-relaxed text-ink-800 min-h-[1.5em]">
              {student.background || <span className="text-ink-400">No background recorded yet.</span>}
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-ink-100 flex items-center gap-2">
            {editing ? (
              <>
                <button onClick={save} className="h-7 px-2.5 rounded-md text-[11.5px] font-medium btn-primary">Save</button>
                <button onClick={() => { setBg(student.background ?? ''); setEditing(false); }} className="h-7 px-2.5 rounded-md text-[11.5px] font-medium border border-ink-200 hover:bg-ink-50">Cancel</button>
              </>
            ) : (
              <button onClick={() => setEditing(true)} className="h-7 px-2.5 rounded-md text-[11.5px] font-medium border border-ink-200 hover:bg-ink-50 flex items-center gap-1">
                <Pencil className="w-3 h-3" /> Edit
              </button>
            )}
            <VoiceButton onTranscript={(text) => { setBg((b) => (b ? b + '\n\n' : '') + text); setEditing(true); }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[12px] uppercase tracking-wider text-ink-500 font-semibold mb-2">{title}</h3>
      <div className="bg-white border border-ink-200/70 rounded-xl px-5">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_1fr] items-center gap-3 py-2.5 border-b border-ink-100 last:border-0">
      <div className="text-[12px] text-ink-500 font-medium">{label}</div>
      <div className="text-[13.5px]">{value}</div>
    </div>
  );
}
