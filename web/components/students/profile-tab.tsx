'use client';

import { useEffect, useRef, useState } from 'react';
import { Pencil, Check, X, Sparkles } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { fmtDate } from '@/lib/utils';
import { VoiceButton } from './voice-button';
import { useToast } from '@/components/shell/toast-region';
import type { Database } from '@/types/database';

type Student = Database['public']['Tables']['students']['Row'] & {
  dipti_comments?: string | null;
};

const MEMBERSHIP_OPTIONS = [
  '', '💎 3A', '💎 LT', '💎 E', '💎 A', '💎 4A', '💎 Dep',
  '💎 3A (EMI)', '💎 LT (EMI)', '💎 E (EMI)', '💎 A (EMI)',
  '💎 E EMI Default', '💎 A EMI Default', 'LT EMI Default', 'Dep Default',
  'Ex-💎', 'R💎 Deposit', 'on hold 💎 Dep', 'Settled',
];

export function ProfileTab({ student }: { student: Student }) {
  const sb = supabaseBrowser();
  const { toast } = useToast();

  // Background editing
  const [bg, setBg] = useState(student.background ?? '');
  const [savedBg, setSavedBg] = useState(student.background ?? '');
  const [editingBg, setEditingBg] = useState(false);

  // Dipti's notes editing (NEW)
  const [diptiNotes, setDiptiNotes] = useState(student.dipti_comments ?? '');
  const [savedDiptiNotes, setSavedDiptiNotes] = useState(student.dipti_comments ?? '');
  const [editingDipti, setEditingDipti] = useState(false);

  // Identity editing
  const [editingIdentity, setEditingIdentity] = useState(false);
  const [firstName, setFirstName] = useState(student.first_name ?? '');
  const [lastName, setLastName] = useState(student.last_name ?? '');
  const [email, setEmail] = useState(student.email ?? '');
  const [mobile, setMobile] = useState(student.mobile ?? '');

  // Program editing
  const [editingProgram, setEditingProgram] = useState(false);
  const [membership, setMembership] = useState(student.membership ?? '');
  const [startDate, setStartDate] = useState(student.start_date ?? '');
  const [endDate, setEndDate] = useState(student.end_date ?? '');

  const lastStudentId = useRef<string>(student.id);
  useEffect(() => {
    if (lastStudentId.current !== student.id) {
      setBg(student.background ?? '');
      setSavedBg(student.background ?? '');
      setEditingBg(false);
      setDiptiNotes(student.dipti_comments ?? '');
      setSavedDiptiNotes(student.dipti_comments ?? '');
      setEditingDipti(false);
      setFirstName(student.first_name ?? '');
      setLastName(student.last_name ?? '');
      setEmail(student.email ?? '');
      setMobile(student.mobile ?? '');
      setEditingIdentity(false);
      setMembership(student.membership ?? '');
      setStartDate(student.start_date ?? '');
      setEndDate(student.end_date ?? '');
      setEditingProgram(false);
      lastStudentId.current = student.id;
    }
  }, [student.id, student.background, student.dipti_comments, student.first_name, student.last_name, student.email, student.mobile, student.membership, student.start_date, student.end_date]);

  async function saveBg() {
    const newValue = bg;
    const { error } = await sb.from('students').update({ background: newValue }).eq('id', student.id);
    if (error) { toast(error.message, 'error'); return; }
    setSavedBg(newValue);
    setEditingBg(false);
    toast('Saved', 'success');
  }

  async function saveDipti() {
    const newValue = diptiNotes;
    const { error } = await sb.from('students').update({ dipti_comments: newValue } as any).eq('id', student.id);
    if (error) { toast(error.message, 'error'); return; }
    setSavedDiptiNotes(newValue);
    setEditingDipti(false);
    toast("Dipti's notes saved", 'success');
  }

  async function saveIdentity() {
    const { error } = await sb.from('students').update({
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
      email: email.trim().toLowerCase(),
      mobile: mobile.trim() || null,
    }).eq('id', student.id);
    if (error) { toast(error.message, 'error'); return; }
    setEditingIdentity(false);
    toast('Identity updated', 'success');
  }

  async function saveProgram() {
    const { error } = await sb.from('students').update({
      membership: membership.trim() || null,
      start_date: startDate || null,
      end_date: endDate || null,
    }).eq('id', student.id);
    if (error) { toast(error.message, 'error'); return; }
    setEditingProgram(false);
    toast('Program updated', 'success');
  }

  function cancelBg() { setBg(savedBg); setEditingBg(false); }
  function cancelDipti() { setDiptiNotes(savedDiptiNotes); setEditingDipti(false); }
  function cancelIdentity() {
    setFirstName(student.first_name ?? '');
    setLastName(student.last_name ?? '');
    setEmail(student.email ?? '');
    setMobile(student.mobile ?? '');
    setEditingIdentity(false);
  }
  function cancelProgram() {
    setMembership(student.membership ?? '');
    setStartDate(student.start_date ?? '');
    setEndDate(student.end_date ?? '');
    setEditingProgram(false);
  }

  return (
    <div className="space-y-7">
      {/* DIPTI'S NOTES — at top so it's prominent */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[12px] uppercase tracking-wider font-semibold flex items-center gap-1.5 text-rose-700">
            <Sparkles className="w-3 h-3" /> Dipti Mam's Notes
          </h3>
        </div>
        <div className="bg-rose-50/50 border border-rose-200/70 rounded-xl p-5">
          {editingDipti ? (
            <textarea
              value={diptiNotes}
              onChange={(e) => setDiptiNotes(e.target.value)}
              rows={4}
              className="w-full text-[13.5px] leading-relaxed outline-none resize-none bg-transparent placeholder:text-ink-400"
              placeholder="Dipti's personal notes about this student…"
              autoFocus
            />
          ) : (
            <div className="text-[13.5px] leading-relaxed text-ink-800 min-h-[1.5em] whitespace-pre-line">
              {savedDiptiNotes || <span className="text-ink-400 italic">No notes from Dipti yet.</span>}
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-rose-200/40 flex items-center gap-2">
            {editingDipti ? (
              <>
                <button onClick={saveDipti} className="h-7 px-2.5 rounded-md text-[11.5px] font-medium btn-primary flex items-center gap-1">
                  <Check className="w-3 h-3" /> Save
                </button>
                <button onClick={cancelDipti} className="h-7 px-2.5 rounded-md text-[11.5px] font-medium border border-rose-200 hover:bg-rose-100 flex items-center gap-1">
                  <X className="w-3 h-3" /> Cancel
                </button>
              </>
            ) : (
              <button onClick={() => setEditingDipti(true)} className="h-7 px-2.5 rounded-md text-[11.5px] font-medium border border-rose-200 hover:bg-rose-100 flex items-center gap-1">
                <Pencil className="w-3 h-3" /> Edit
              </button>
            )}
            <VoiceButton onTranscript={(text) => { setDiptiNotes((b) => (b ? b + '\n\n' : '') + text); setEditingDipti(true); }} />
          </div>
        </div>
      </div>

      {/* IDENTITY */}
      <div>
        <SectionHeader title="Identity" editing={editingIdentity} onEdit={() => setEditingIdentity(true)} onSave={saveIdentity} onCancel={cancelIdentity} />
        <div className="bg-white border border-ink-200/70 rounded-xl px-5">
          <EditableField label="First name" editing={editingIdentity} value={firstName} display={student.first_name ?? '—'} onChange={setFirstName} />
          <EditableField label="Last name" editing={editingIdentity} value={lastName} display={student.last_name ?? '—'} onChange={setLastName} />
          <EditableField label="Email" editing={editingIdentity} value={email} display={student.email} type="email" onChange={setEmail} />
          <EditableField label="Mobile" editing={editingIdentity} value={mobile} display={student.mobile ?? '—'} type="tel" onChange={setMobile} />
        </div>
      </div>

      {/* PROGRAM */}
      <div>
        <SectionHeader title="Program" editing={editingProgram} onEdit={() => setEditingProgram(true)} onSave={saveProgram} onCancel={cancelProgram} />
        <div className="bg-white border border-ink-200/70 rounded-xl px-5">
          {editingProgram ? (
            <EditableField
              label="Membership"
              editing
              value={membership}
              display={student.membership ?? '—'}
              onChange={setMembership}
              isSelect
              options={MEMBERSHIP_OPTIONS}
            />
          ) : (
            <Field label="Membership" value={<span className="font-medium">{student.membership ?? '—'}</span>} />
          )}
          <Field label="Tags" value={student.tags?.length
            ? <>{student.tags.map((t) => <span key={t} className="text-[10.5px] font-medium px-1.5 py-0.5 rounded bg-ink-100 text-ink-700 mr-1">{t}</span>)}</>
            : <span className="text-ink-400">none</span>} />
          <EditableField label="Start date" editing={editingProgram} value={startDate} display={fmtDate(student.start_date)} type="date" onChange={setStartDate} />
          <EditableField label="End date" editing={editingProgram} value={endDate} display={fmtDate(student.end_date)} type="date" onChange={setEndDate} />
        </div>
      </div>

      {/* BACKGROUND */}
      <div>
        <h3 className="text-[12px] uppercase tracking-wider text-ink-500 font-semibold mb-2">Background</h3>
        <div className="bg-white border border-ink-200/70 rounded-xl p-5">
          {editingBg ? (
            <textarea
              value={bg} onChange={(e) => setBg(e.target.value)}
              rows={4}
              className="w-full text-[13.5px] leading-relaxed outline-none resize-none placeholder:text-ink-400"
              placeholder="What's the student's story? Personality, key context, things to remember…"
              autoFocus
            />
          ) : (
            <div className="text-[13.5px] leading-relaxed text-ink-800 min-h-[1.5em] whitespace-pre-line">
              {savedBg || <span className="text-ink-400">No background recorded yet.</span>}
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-ink-100 flex items-center gap-2">
            {editingBg ? (
              <>
                <button onClick={saveBg} className="h-7 px-2.5 rounded-md text-[11.5px] font-medium btn-primary">Save</button>
                <button onClick={cancelBg} className="h-7 px-2.5 rounded-md text-[11.5px] font-medium border border-ink-200 hover:bg-ink-50">Cancel</button>
              </>
            ) : (
              <button onClick={() => setEditingBg(true)} className="h-7 px-2.5 rounded-md text-[11.5px] font-medium border border-ink-200 hover:bg-ink-50 flex items-center gap-1">
                <Pencil className="w-3 h-3" /> Edit
              </button>
            )}
            <VoiceButton onTranscript={(text) => { setBg((b) => (b ? b + '\n\n' : '') + text); setEditingBg(true); }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, editing, onEdit, onSave, onCancel }: {
  title: string;
  editing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-[12px] uppercase tracking-wider text-ink-500 font-semibold">{title}</h3>
      {editing ? (
        <div className="flex gap-1">
          <button onClick={onSave} className="h-7 px-2.5 rounded-md text-[11.5px] font-medium btn-primary flex items-center gap-1">
            <Check className="w-3 h-3" /> Save
          </button>
          <button onClick={onCancel} className="h-7 px-2.5 rounded-md text-[11.5px] font-medium border border-ink-200 hover:bg-ink-50 flex items-center gap-1">
            <X className="w-3 h-3" /> Cancel
          </button>
        </div>
      ) : (
        <button onClick={onEdit} className="h-7 px-2.5 rounded-md text-[11.5px] font-medium border border-ink-200 hover:bg-ink-50 flex items-center gap-1">
          <Pencil className="w-3 h-3" /> Edit
        </button>
      )}
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

function EditableField({
  label, editing, value, display, onChange, type = 'text', isSelect = false, options = [],
}: {
  label: string;
  editing: boolean;
  value: string;
  display: React.ReactNode;
  onChange: (v: string) => void;
  type?: 'text' | 'email' | 'tel' | 'date';
  isSelect?: boolean;
  options?: string[];
}) {
  return (
    <div className="grid grid-cols-[160px_1fr] items-center gap-3 py-2.5 border-b border-ink-100 last:border-0">
      <div className="text-[12px] text-ink-500 font-medium">{label}</div>
      <div className="text-[13.5px]">
        {editing ? (
          isSelect ? (
            <select
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="w-full h-8 px-2 text-[13px] border border-ink-200 rounded-md outline-none focus:border-accent-500 bg-white"
            >
              {options.map((opt) => (
                <option key={opt} value={opt}>{opt || '— None —'}</option>
              ))}
            </select>
          ) : (
            <input
              type={type}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="w-full h-8 px-2 text-[13px] border border-ink-200 rounded-md outline-none focus:border-accent-500"
            />
          )
        ) : (
          display
        )}
      </div>
    </div>
  );
}