'use client';
 
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Plus, Loader2, Search, X, IndianRupee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/shell/toast-region';
import { supabaseBrowser } from '@/lib/supabase/client';
import { EmiSetupModal } from '@/components/students/emi-setup-modal';
 
export function EmiActions() {
  const { toast } = useToast();
  const sb = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [chosenStudentId, setChosenStudentId] = useState<string | null>(null);
 
  async function onExport() {
    setExporting(true);
    try {
      // Pull every EMI row with the student linked, ordered for predictable output.
      const { data, error } = await sb
        .from('emi_schedule')
        .select(`
          installment_no, installments_total, amount, due_date, reminder_date,
          status, paid_date, payment_mode, payment_link,
          students!inner(first_name, last_name, email, mobile, ghl_contact_id)
        `)
        .order('due_date');
 
      if (error) throw error;
 
      const rows = (data ?? []) as any[];
      if (rows.length === 0) {
        toast('No EMI rows to export.', 'info');
        return;
      }
 
      // Build CSV
      const headers = [
        'Student', 'Email', 'Mobile', 'GHL Contact ID',
        'Installment', 'Of Total', 'Amount (INR)',
        'Due Date', 'Reminder Date', 'Status', 'Paid Date',
        'Payment Mode', 'Payment Link',
      ];
 
      const csvRows = rows.map((r) => {
        const s = r.students || {};
        const name = `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim();
        return [
          name, s.email ?? '', s.mobile ?? '', s.ghl_contact_id ?? '',
          r.installment_no, r.installments_total, r.amount,
          r.due_date ?? '', r.reminder_date ?? '', r.status ?? '', r.paid_date ?? '',
          r.payment_mode ?? '', r.payment_link ?? '',
        ];
      });
 
      const csv = [headers, ...csvRows].map(toCsvLine).join('\r\n');
      // Prepend BOM so Excel opens UTF-8 properly (₹ etc.)
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
 
      const stamp = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `emi-schedule_${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
 
      toast(`Exported ${rows.length} rows.`, 'success');
    } catch (e: any) {
      toast(e.message ?? 'Export failed.', 'error');
    } finally {
      setExporting(false);
    }
  }
 
  return (
    <>
      <div className="flex items-center gap-2">
        <Button onClick={onExport} disabled={exporting}>
          {exporting
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Exporting…</>
            : <><Download className="w-4 h-4" /> Export</>}
        </Button>
        <Button variant="primary" onClick={() => setPickerOpen(true)}>
          <Plus className="w-4 h-4" /> Add EMI
        </Button>
      </div>
 
      {/* Step 1: pick a student */}
      {pickerOpen && !chosenStudentId && (
        <StudentPickerModal
          onClose={() => setPickerOpen(false)}
          onPick={(id) => setChosenStudentId(id)}
        />
      )}
 
      {/* Step 2: existing EMI setup modal for that student */}
      {pickerOpen && chosenStudentId && (
        <EmiSetupModal
          studentId={chosenStudentId}
          onClose={() => { setPickerOpen(false); setChosenStudentId(null); }}
          onSaved={() => {
            setPickerOpen(false);
            setChosenStudentId(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
 
/* --------------------------- Student picker --------------------------- */
 
type StudentLite = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  hasEmi: boolean;
};
 
function StudentPickerModal({
  onClose, onPick,
}: {
  onClose: () => void;
  onPick: (studentId: string) => void;
}) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const { toast } = useToast();
  const [students, setStudents] = useState<StudentLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [onlyWithoutEmi, setOnlyWithoutEmi] = useState(true);
 
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        // Fetch students + count of their existing EMI rows
        const [{ data: stu }, { data: emiRows }] = await Promise.all([
          sb.from('students')
            .select('id, first_name, last_name, email')
            .order('first_name', { nullsFirst: false })
            .limit(1000),
          sb.from('emi_schedule').select('student_id'),
        ]);
        if (cancel) return;
        const withEmi = new Set<string>(((emiRows ?? []) as any[]).map((r) => r.student_id));
        const list: StudentLite[] = ((stu ?? []) as any[]).map((s) => ({
          id: s.id,
          first_name: s.first_name,
          last_name: s.last_name,
          email: s.email,
          hasEmi: withEmi.has(s.id),
        }));
        setStudents(list);
      } catch (e: any) {
        toast(e.message ?? 'Failed to load students', 'error');
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [sb, toast]);
 
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((s) => {
      if (onlyWithoutEmi && s.hasEmi) return false;
      if (!q) return true;
      const hay = `${s.first_name ?? ''} ${s.last_name ?? ''} ${s.email}`.toLowerCase();
      return hay.includes(q);
    });
  }, [students, query, onlyWithoutEmi]);
 
  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center pt-[6vh] px-4"
      onMouseDown={onClose}
    >
      <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-[560px] bg-white rounded-2xl shadow-pop border border-ink-200/70 overflow-hidden max-h-[88vh] flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 h-14 border-b border-ink-100 shrink-0">
          <div className="flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-ink-500" />
            <div className="font-semibold text-[15px]">Add EMI — pick a student</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-md hover:bg-ink-100 grid place-items-center" aria-label="Close">
            <X className="w-4 h-4 text-ink-500" />
          </button>
        </div>
 
        <div className="p-4 border-b border-ink-100 space-y-2.5 shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              autoFocus
              type="text"
              placeholder="Search by name or email…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-ink-200 focus:border-accent-500 focus:ring-2 focus:ring-accent-100 outline-none text-[13px] bg-white"
            />
          </div>
          <label className="flex items-center gap-2 text-[12px] text-ink-600 select-none">
            <input
              type="checkbox"
              checked={onlyWithoutEmi}
              onChange={(e) => setOnlyWithoutEmi(e.target.checked)}
              className="accent-accent-600"
            />
            Only show students without an existing EMI plan
          </label>
        </div>
 
        <div className="overflow-auto flex-1 min-h-[200px]">
          {loading ? (
            <div className="p-6 text-center text-[13px] text-ink-400">
              <Loader2 className="w-4 h-4 animate-spin inline-block mr-2 align-text-bottom" />
              Loading students…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-[13px] text-ink-400">
              {query
                ? 'No students match that search.'
                : onlyWithoutEmi
                  ? 'Every student already has an EMI plan. Uncheck the filter above to add another schedule.'
                  : 'No students found.'}
            </div>
          ) : (
            <ul className="divide-y divide-ink-100">
              {filtered.slice(0, 200).map((s) => {
                const name = `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || '(no name)';
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => onPick(s.id)}
                      className="w-full flex items-center justify-between px-5 py-2.5 hover:bg-ink-50 text-left"
                    >
                      <div>
                        <div className="text-[13.5px] font-medium text-ink-800">{name}</div>
                        <div className="text-[11.5px] text-ink-500">{s.email}</div>
                      </div>
                      {s.hasEmi && (
                        <span className="text-[10.5px] text-amber-700 bg-amber-50 ring-1 ring-amber-100 px-2 py-0.5 rounded-full">
                          has EMI
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
              {filtered.length > 200 && (
                <li className="px-5 py-3 text-[11.5px] text-ink-400 text-center">
                  Showing first 200 — refine your search to see more.
                </li>
              )}
            </ul>
          )}
        </div>
 
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-ink-100 shrink-0">
          <Button type="button" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}
 
/* --------------------------- CSV helpers --------------------------- */
 
function toCsvLine(values: (string | number | null)[]): string {
  return values.map(csvCell).join(',');
}
 
function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  // Quote if contains comma, quote, newline, or leading/trailing whitespace
  if (/[",\n\r]/.test(s) || /^\s|\s$/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}