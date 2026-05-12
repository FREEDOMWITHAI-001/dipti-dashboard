'use client';

import { useState } from 'react';
import { ExternalLink, Link2 } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useToast } from '@/components/shell/toast-region';
import { cn } from '@/lib/utils';
import type { Database } from '@/types/database';

type Event = Database['public']['Tables']['reminder_events']['Row'];

const RECIPIENT_CLS: Record<string, string> = {
  student: 'bg-accent-50 text-accent-700 ring-accent-100',
  coach:   'bg-emerald-50 text-emerald-700 ring-emerald-100',
  admin:   'bg-amber-50 text-amber-800 ring-amber-100',
};

// Show a compact preview for long webhook URLs so they don't overflow.
//  "https://services.leadconnectorhq.com/hooks/.../webhook-trigger/64a0d031-..."
//  → "webhook · ...2667431fb"
function previewWorkflow(v: string | null, fallback: string): string {
  if (!v) return fallback;
  if (v.startsWith('http://') || v.startsWith('https://')) {
    const tail = v.slice(-12);
    return `webhook · …${tail}`;
  }
  return v;
}

export function ReminderEventsTable({ events }: { events: Event[] }) {
  const sb = supabaseBrowser();
  const { toast } = useToast();
  const [items, setItems] = useState(events);

  async function toggle(id: string, enabled: boolean) {
    setItems((arr) => arr.map((e) => (e.id === id ? { ...e, enabled } : e)));
    const { error } = await sb.from('reminder_events').update({ enabled }).eq('id', id);
    if (error) toast(error.message, 'error');
  }

  return (
    <div className="bg-white border border-ink-200/70 rounded-xl">
      <div className="px-5 py-3 border-b border-ink-100 text-[13px] font-semibold">Event catalog</div>
      <div className="grid grid-cols-[1.4fr_110px_130px_180px_60px] gap-4 px-5 py-2.5 text-[10.5px] uppercase tracking-wider text-ink-500 font-semibold border-b border-ink-100">
        <div>Event</div><div>Recipient</div><div>Schedule</div><div>GHL workflow</div><div className="text-right">On</div>
      </div>
      {items.map((e) => {
        const fallback = `${e.id.split('.')[0]}-flow`;
        const isWebhook = !!e.default_workflow_id && (
          e.default_workflow_id.startsWith('http://') || e.default_workflow_id.startsWith('https://')
        );
        const preview = previewWorkflow(e.default_workflow_id, fallback);
        const fullValue = e.default_workflow_id ?? fallback;
        return (
          <div key={e.id} className="grid grid-cols-[1.4fr_110px_130px_180px_60px] gap-4 px-5 py-3.5 items-center border-b border-ink-100 last:border-0 text-[13px]">
            <div className="min-w-0">
              <div className="font-medium truncate">{e.name}</div>
              <code className="text-[10.5px] text-ink-500 font-mono truncate block">{e.id}</code>
            </div>
            <div>
              <span className={cn('text-[11.5px] font-medium px-2 py-0.5 rounded-full ring-1 ring-inset', RECIPIENT_CLS[e.recipient_type])}>
                {e.recipient_type[0].toUpperCase() + e.recipient_type.slice(1)}
              </span>
            </div>
            <div className="text-ink-700 text-[12.5px] truncate">{e.schedule}</div>
            <div className="min-w-0">
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(fullValue);
                    toast('Copied to clipboard', 'success');
                  } catch {
                    toast(fullValue, 'info');
                  }
                }}
                className="text-[12px] underline-offset-2 hover:underline text-accent-700 flex items-center gap-1 w-full max-w-full"
                title={fullValue}
              >
                {isWebhook && <Link2 className="w-3 h-3 flex-shrink-0" />}
                <span className="truncate">{preview}</span>
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
              </button>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => toggle(e.id, !e.enabled)}
                className={cn('relative w-8 h-[18px] rounded-full transition', e.enabled ? 'bg-emerald-500' : 'bg-ink-200')}
              >
                <span className={cn('absolute top-[2px] w-3.5 h-3.5 bg-white rounded-full shadow', e.enabled ? 'right-[2px]' : 'left-[2px]')} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}