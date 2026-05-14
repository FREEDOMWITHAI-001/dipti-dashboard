'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, Send, MessageCircle, Smartphone, Mail, ChevronDown } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useToast } from '@/components/shell/toast-region';
import { StudentAvatar } from '@/components/ui/avatar';
import { fmtINR, fmtDate, cn } from '@/lib/utils';
import type { Database } from '@/types/database';

type Student = Database['public']['Tables']['students']['Row'];
type Emi = Database['public']['Tables']['emi_schedule']['Row'];
type Channel = 'whatsapp' | 'sms' | 'email';

export function ReminderModal({ open, onClose, studentId, emiId }: {
  open: boolean; onClose: () => void; studentId: string; emiId?: string;
}) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const { toast } = useToast();
  const [student, setStudent] = useState<Student | null>(null);
  const [emi, setEmi] = useState<Emi | null>(null);
  const [channel, setChannel] = useState<Channel>('whatsapp');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancel = false;
    (async () => {
      const [{ data: s }, emiQ] = await Promise.all([
        sb.from('students').select('*').eq('id', studentId).maybeSingle(),
        emiId
          ? sb.from('emi_schedule').select('*').eq('id', emiId).maybeSingle()
          : sb.from('emi_schedule').select('*').eq('student_id', studentId).neq('status', 'paid').order('installment_no').limit(1).maybeSingle(),
      ]);
      if (!cancel) { setStudent(s); setEmi(emiQ.data ?? null); }
    })();
    return () => { cancel = true; };
  }, [open, studentId, emiId, sb]);

  if (!open) return null;

  const message = student && emi
    ? `Hi ${student.first_name ?? 'there'}, your EMI of ${fmtINR(Number(emi.amount))} (${emi.installment_no}/${emi.installments_total}) is due on ${fmtDate(emi.due_date)}. Pay here: ${emi.payment_link ?? '[link]'}\n— Team DVA`
    : '';

  async function send() {
    if (!student) return;
    setSending(true);
    try {
      const r = await fetch('/api/ghl/trigger-workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: student.id,
          emiId: emi?.id ?? null,
          channel,
          payload: {
            first_name: student.first_name,
            last_name: student.last_name,
            email: student.email,
            phone: student.mobile,
            emi_amount: emi?.amount,
            payment_link: emi?.payment_link ?? '',
            due_date: emi?.due_date,
            installment: emi ? `${emi.installment_no}/${emi.installments_total}` : '',
          },
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      toast('Reminder sent · GHL workflow triggered', 'success');
      onClose();
    } catch (e: any) {
      toast(e.message ?? 'Failed', 'error');
    }
    setSending(false);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center px-4">
      <div onClick={onClose} className="absolute inset-0 bg-ink-950/40 transition-opacity duration-200" />
      <div className="relative bg-white rounded-2xl shadow-pop w-full max-w-[520px] overflow-hidden">
        <div className="p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="text-[18px] font-semibold tracking-tight">Send reminder</div>
              <div className="text-[12.5px] text-ink-500 mt-0.5">via GoHighLevel · routes to student's preferred channel</div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-md hover:bg-ink-100 grid place-items-center"><X className="w-4 h-4" /></button>
          </div>

          {student && (
            <div className="bg-ink-50 rounded-xl p-3.5 flex items-center gap-3 mb-5">
              <StudentAvatar first={student.first_name} last={student.last_name} size={36} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[13.5px]">{student.first_name} {student.last_name}</div>
                <div className="text-[12px] text-ink-500">{student.mobile ?? student.email}</div>
              </div>
              {emi && (
                <div className="text-right">
                  <div className="font-mono text-[11.5px] text-ink-500">{emi.installment_no}/{emi.installments_total}</div>
                  <div className="font-semibold text-[14px]">{fmtINR(Number(emi.amount))}</div>
                </div>
              )}
            </div>
          )}

          <Section label="Channel">
            <div className="grid grid-cols-3 gap-2">
              <ChannelBtn val="whatsapp" current={channel} onClick={setChannel} icon={<MessageCircle className="w-4 h-4" />} label="WhatsApp" />
              <ChannelBtn val="sms"      current={channel} onClick={setChannel} icon={<Smartphone className="w-4 h-4" />} label="SMS" />
              <ChannelBtn val="email"    current={channel} onClick={setChannel} icon={<Mail className="w-4 h-4" />} label="Email" />
            </div>
          </Section>

          <Section label="GHL Workflow">
            <button className="h-10 px-3 w-full rounded-lg border border-ink-200 hover:bg-ink-50 text-left text-[13px] flex items-center justify-between">
              <span><span className="font-medium">EMI Reminder · Diamond</span> <span className="text-ink-500">— wf_a3k9d</span></span>
              <ChevronDown className="w-4 h-4 text-ink-500" />
            </button>
          </Section>

          <Section label="Preview">
            <div className="bg-emerald-50/30 border border-emerald-100 rounded-xl p-3.5 text-[13px] leading-relaxed whitespace-pre-line text-ink-800">
              {message || <span className="text-ink-400">No EMI on file.</span>}
            </div>
          </Section>

          <div className="flex items-center gap-2 mt-6">
            <button onClick={onClose} className="h-10 px-4 rounded-lg border border-ink-200 text-[13px] font-medium hover:bg-ink-50">Cancel</button>
            <button onClick={send} disabled={sending || !emi}
              className="btn-primary ml-auto h-10 px-5 rounded-lg text-[13px] font-medium flex items-center gap-2 disabled:opacity-50">
              {sending ? 'Sending…' : <>Send via GHL <Send className="w-4 h-4" /></>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5 last:mb-0">
      <div className="text-[11.5px] uppercase tracking-wider font-semibold text-ink-500 mb-2">{label}</div>
      {children}
    </div>
  );
}

function ChannelBtn({ val, current, onClick, icon, label }: { val: Channel; current: Channel; onClick: (v: Channel) => void; icon: React.ReactNode; label: string }) {
  const sel = current === val;
  return (
    <button onClick={() => onClick(val)} className={cn(
      'h-10 rounded-lg text-[13px] font-medium flex items-center justify-center gap-2',
      sel ? 'border-2 border-accent-500 bg-accent-50/40 text-accent-700' : 'border border-ink-200 hover:bg-ink-50'
    )}>
      {icon} {label}
    </button>
  );
}