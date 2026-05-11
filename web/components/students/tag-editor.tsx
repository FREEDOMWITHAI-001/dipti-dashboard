'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useToast } from '@/components/shell/toast-region';

export function TagEditor({
  studentId,
  tags,
  onChange,
}: {
  studentId: string;
  tags: string[];
  onChange: (next: string[]) => void;
}) {
  const sb = supabaseBrowser();
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (adding) inputRef.current?.focus(); }, [adding]);

  async function persist(next: string[]) {
    const prev = tags;
    onChange(next);
    const { error } = await sb.from('students').update({ tags: next }).eq('id', studentId);
    if (error) {
      onChange(prev);
      toast(error.message, 'error');
    }
  }

  async function addTag() {
    const value = draft.trim();
    setDraft('');
    setAdding(false);
    if (!value) return;
    if (tags.includes(value)) {
      toast(`Tag "${value}" already added.`, 'info');
      return;
    }
    await persist([...tags, value]);
  }

  async function removeTag(t: string) {
    await persist(tags.filter((x) => x !== t));
  }

  return (
    <div className="flex items-center gap-2 mt-2.5 flex-wrap">
      {tags.map((t) => (
        <span key={t} className="text-[10.5px] font-medium pl-2 pr-1 py-0.5 rounded bg-ink-100 text-ink-700 inline-flex items-center gap-1">
          {t}
          <button
            onClick={() => removeTag(t)}
            className="w-4 h-4 rounded hover:bg-ink-200 grid place-items-center"
            aria-label={`Remove ${t}`}
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </span>
      ))}
      {adding ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={addTag}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); addTag(); }
            if (e.key === 'Escape') { setDraft(''); setAdding(false); }
          }}
          placeholder="new tag…"
          maxLength={24}
          className="text-[10.5px] font-medium px-2 py-0.5 rounded border border-ink-300 outline-none focus:border-accent-500 w-[100px]"
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="text-[10.5px] font-medium px-2 py-0.5 rounded border border-dashed border-ink-300 text-ink-500 hover:bg-ink-50 flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> add tag
        </button>
      )}
    </div>
  );
}
