'use client';

import { useRouter } from 'next/navigation';
import { Phone } from 'lucide-react';
import { StudentAvatar } from '@/components/ui/avatar';
import { StatusPill } from '@/components/ui/status-pill';
import { useToast } from '@/components/shell/toast-region';

type Row = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  mobile: string | null;
};

export function QueueCard({ row }: { row: Row }) {
  const router = useRouter();
  const { toast } = useToast();

  function openStudent() {
    router.push(`/students?student=${row.id}` as any);
  }

  function callNow(e: React.MouseEvent) {
    e.stopPropagation();
    if (row.mobile) {
      window.location.href = `tel:${row.mobile.replace(/\s+/g, '')}`;
    } else {
      toast('No mobile number on file — open the student profile to add one.', 'info');
      openStudent();
    }
  }

  function skip(e: React.MouseEvent) {
    e.stopPropagation();
    toast('Skipped — refresh to repopulate queue.', 'info');
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openStudent}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openStudent(); } }}
      className="bg-white border border-ink-200/70 rounded-xl p-5 hover:shadow-soft transition cursor-pointer"
    >
      <div className="flex items-start gap-3 mb-3">
        <StudentAvatar first={row.first_name} last={row.last_name} size={40} />
        <div className="flex-1 min-w-0">
          <div className="font-semibold">{row.first_name} {row.last_name}</div>
          <div className="text-[11.5px] text-ink-500">{row.mobile ?? row.email}</div>
        </div>
        <StatusPill status="active" label="Silent 30d+" />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={callNow}
          className="btn-primary h-8 px-3 rounded-md text-[12px] font-medium flex items-center gap-1.5"
        >
          <Phone className="w-3.5 h-3.5" /> Call now
        </button>
        <button
          type="button"
          onClick={skip}
          className="h-8 px-3 rounded-md border border-ink-200 text-[12px] font-medium hover:bg-ink-50"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
