'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, UserPlus, ShieldCheck, Loader2, AlertTriangle,
  Trash2, ArrowDown, ArrowUp, Check,
} from 'lucide-react';
import { useToast } from '@/components/shell/toast-region';

export type TeamMember = { id: string; email: string; display_name: string; initials: string; role: string; permissions?: string[] };


// ============================================================================
// Team Access — manage admins & coaches with delete/demote/promote actions
// ============================================================================

export function TeamAccessCard({
  admins, coaches, currentUserId,
}: {
  admins: TeamMember[];
  coaches: TeamMember[];
  currentUserId: string | null;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [tab, setTab] = useState<'create' | 'promote'>('create');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [permsUser, setPermsUser] = useState<TeamMember | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    tone: 'danger' | 'warn' | 'primary';
    onConfirm: () => void;
  } | null>(null);

  const [coachForm, setCoachForm] = useState({
    email: '', password: '', name: '', initials: '', makeAdmin: false,
  });
  const [creating, setCreating] = useState(false);

  const [promoteEmail, setPromoteEmail] = useState('');
  const [promoting, setPromoting] = useState(false);

  const totalAdmins = admins.length;
  const isLastAdmin = totalAdmins <= 1;

  async function deleteUser(m: TeamMember) {
    if (m.id === currentUserId) { toast("You can't delete your own account.", 'error'); return; }
    if (m.role === 'admin' && isLastAdmin) {
      toast("Can't delete the last admin — promote another user first.", 'error'); return;
    }
    const label = m.display_name || m.email;
    setConfirmAction({
      title: 'Delete user?',
      message: `Permanently delete ${label}? This cannot be undone.`,
      confirmLabel: 'Delete user',
      tone: 'danger',
      onConfirm: () => doDelete(m),
    });
  }

  async function doDelete(m: TeamMember) {
    setConfirmAction(null);
    setBusyId(m.id);
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: m.id }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast(`Deleted ${m.display_name || m.email}`, 'success');
      setTimeout(() => window.location.reload(), 600);
    } catch (e: any) { toast(e.message ?? 'Delete failed', 'error'); }
    finally { setBusyId(null); }
  }

  async function demote(m: TeamMember) {
    if (m.id === currentUserId) { toast("You can't demote yourself.", 'error'); return; }
    if (isLastAdmin) {
      toast("Can't demote the last admin — promote another user first.", 'error'); return;
    }
    setConfirmAction({
      title: 'Demote to coach?',
      message: `${m.display_name || m.email} will lose admin privileges and become a coach.`,
      confirmLabel: 'Demote',
      tone: 'warn',
      onConfirm: () => doDemote(m),
    });
  }

  async function doDemote(m: TeamMember) {
    setConfirmAction(null);
    setBusyId(m.id);
    try {
      const res = await fetch('/api/admin/demote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: m.id }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast(`Demoted ${m.display_name || m.email} to coach`, 'success');
      setTimeout(() => window.location.reload(), 600);
    } catch (e: any) { toast(e.message ?? 'Demote failed', 'error'); }
    finally { setBusyId(null); }
  }

  async function promoteRow(m: TeamMember) {
    setConfirmAction({
      title: 'Promote to admin?',
      message: `${m.display_name || m.email} will gain full admin access including team management.`,
      confirmLabel: 'Promote',
      tone: 'primary',
      onConfirm: () => doPromote(m),
    });
  }

  async function doPromote(m: TeamMember) {
    setConfirmAction(null);
    setBusyId(m.id);
    try {
      const res = await fetch('/api/admin/promote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: m.email }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast(`Promoted ${m.display_name || m.email} to admin`, 'success');
      setTimeout(() => window.location.reload(), 600);
    } catch (e: any) { toast(e.message ?? 'Promote failed', 'error'); }
    finally { setBusyId(null); }
  }

  async function createCoach() {
    if (!coachForm.email.trim() || !coachForm.password.trim()) {
      toast('Email and password are required', 'error'); return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/admin/create-coach', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(coachForm),
      });
      if (!res.ok) throw new Error(await res.text());
      toast(`Coach created: ${coachForm.email}`, 'success');
      setCoachForm({ email: '', password: '', name: '', initials: '', makeAdmin: false });
      setTimeout(() => window.location.reload(), 800);
    } catch (e: any) { toast(e.message ?? 'Failed to create coach', 'error'); }
    finally { setCreating(false); }
  }

  async function promoteByEmail() {
    if (!promoteEmail.trim()) { toast('Email is required', 'error'); return; }
    setPromoting(true);
    try {
      const res = await fetch('/api/admin/promote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: promoteEmail.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast(`Promoted ${promoteEmail} to admin`, 'success');
      setPromoteEmail('');
      setTimeout(() => window.location.reload(), 800);
    } catch (e: any) { toast(e.message ?? 'Promote failed', 'error'); }
    finally { setPromoting(false); }
  }

  return (
    <Card title="Team access" icon={<Users className="w-4 h-4 text-accent-700" />}
      desc="Manage admins and coaches. Admins can manage settings; coaches can log calls and view students."
    >
      <MemberSection title="Admins" icon={<ShieldCheck className="w-3 h-3" />} count={admins.length} emptyMsg="No admin profiles loaded.">
        {admins.map((m) => (
          <MemberRow key={m.id} member={m} isMe={m.id === currentUserId} busy={busyId === m.id}
            isLastAdmin={isLastAdmin}
            onDelete={() => deleteUser(m)}
            onDemote={() => demote(m)}
          />
        ))}
      </MemberSection>

      <MemberSection title="Coaches" icon={<Users className="w-3 h-3" />} count={coaches.length} emptyMsg="No coaches yet — create one below.">
        {coaches.map((m) => (
          <MemberRow key={m.id} member={m} isMe={m.id === currentUserId} busy={busyId === m.id}
            isLastAdmin={isLastAdmin}
            onDelete={() => deleteUser(m)}
            onPromote={() => promoteRow(m)}
            onPermissions={() => setPermsUser(m)}
          />
        ))}
      </MemberSection>

      <div className="flex gap-1 border-b border-ink-100 mb-3 mt-4">
        <TabBtn active={tab === 'create'} onClick={() => setTab('create')}>
          <UserPlus className="w-3 h-3" /> Create coach
        </TabBtn>
        <TabBtn active={tab === 'promote'} onClick={() => setTab('promote')}>
          <ShieldCheck className="w-3 h-3" /> Promote by email
        </TabBtn>
      </div>

      {tab === 'create' && (
        <div className="grid gap-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            <InputField label="Email" value={coachForm.email}
              onChange={(v) => setCoachForm((f) => ({ ...f, email: v }))}
              placeholder="coach@example.com" type="email" />
            <InputField label="Password" value={coachForm.password}
              onChange={(v) => setCoachForm((f) => ({ ...f, password: v }))}
              placeholder="min 6 characters" type="password" />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <InputField label="Display name" value={coachForm.name}
              onChange={(v) => setCoachForm((f) => ({ ...f, name: v }))}
              placeholder="Dipti Vartak" />
            <InputField label="Initials (1-3 chars)" value={coachForm.initials}
              onChange={(v) => setCoachForm((f) => ({ ...f, initials: v.toUpperCase().slice(0, 3) }))}
              placeholder="DV" />
          </div>
          <label className="flex items-center gap-2 text-[12.5px] text-ink-700 cursor-pointer">
            <input type="checkbox" checked={coachForm.makeAdmin}
              onChange={(e) => setCoachForm((f) => ({ ...f, makeAdmin: e.target.checked }))}
              className="rounded border-ink-300"
            />
            Make admin (can manage settings and other coaches)
          </label>
          <button onClick={createCoach} disabled={creating}
            className="h-8 px-3 rounded-lg bg-ink-900 text-white text-[12.5px] font-medium inline-flex items-center gap-1.5 hover:bg-ink-800 disabled:opacity-50 self-start mt-1"
          >
            {creating ? <><Loader2 className="w-3 h-3 animate-spin" /> Creating…</> : <><UserPlus className="w-3 h-3" /> Create coach</>}
          </button>
        </div>
      )}

      {tab === 'promote' && (
        <div className="grid gap-2.5">
          <p className="text-[12.5px] text-ink-600">
            Promote a user by email. They must already exist in the system (have logged in at least once).
          </p>
          <InputField label="User's email" value={promoteEmail} onChange={setPromoteEmail}
            placeholder="user@example.com" type="email" />
          <button onClick={promoteByEmail} disabled={promoting}
            className="h-8 px-3 rounded-lg bg-ink-900 text-white text-[12.5px] font-medium inline-flex items-center gap-1.5 hover:bg-ink-800 disabled:opacity-50 self-start"
          >
            {promoting ? <><Loader2 className="w-3 h-3 animate-spin" /> Promoting…</> : <><ShieldCheck className="w-3 h-3" /> Promote to admin</>}
          </button>
        </div>
      )}
    
      {permsUser && (
        <InlinePermissionsModal
          user={permsUser}
          onClose={() => setPermsUser(null)}
          onSaved={() => {
            setPermsUser(null);
            // Refresh server-fetched data so the next open shows fresh permissions
            router.refresh();
          }}
        />
      )}
      {confirmAction && (
        <ConfirmDialog
          title={confirmAction.title}
          message={confirmAction.message}
          confirmLabel={confirmAction.confirmLabel}
          tone={confirmAction.tone}
          onConfirm={confirmAction.onConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </Card>
  );
}

function MemberSection({
  title, icon, count, emptyMsg, children,
}: { title: string; icon: React.ReactNode; count: number; emptyMsg: string; children: React.ReactNode }) {
  const hasChildren = count > 0;
  return (
    <div className="mb-4">
      <div className="text-[11.5px] uppercase tracking-wider text-ink-500 font-semibold mb-2 flex items-center gap-1.5">
        {icon} {title} ({count})
      </div>
      {hasChildren ? (
        <div className="border border-ink-200/70 rounded-lg divide-y divide-ink-100 overflow-hidden">
          {children}
        </div>
      ) : (
        <div className="text-[12px] text-ink-500 italic">{emptyMsg}</div>
      )}
    </div>
  );
}

function MemberRow({
  member, isMe, busy, isLastAdmin, onDelete, onDemote, onPromote, onPermissions,
}: {
  member: TeamMember;
  isMe: boolean;
  busy: boolean;
  isLastAdmin: boolean;
  onDelete: () => void;
  onDemote?: () => void;
  onPromote?: () => void;
  onPermissions?: () => void;
}) {
  const label = member.display_name || member.email || member.id.slice(0, 6);
  const initialsTxt = (member.initials || label).slice(0, 2).toUpperCase();
  const cannotDelete = isMe || (member.role === 'admin' && isLastAdmin);
  const cannotDemote = isMe || isLastAdmin;
  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-white hover:bg-ink-50/50">
      <span className={`w-7 h-7 rounded-full text-[10px] font-semibold grid place-items-center ${member.role === 'admin' ? 'bg-accent-100 text-accent-700' : 'bg-emerald-100 text-emerald-700'}`}>
        {initialsTxt}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-medium text-ink-900 truncate">
          {label} {isMe && <span className="text-[10.5px] text-ink-500 font-normal">· you</span>}
        </div>
        <div className="text-[11px] text-ink-500 truncate">{member.email}</div>
      </div>
      <div className="flex items-center gap-1">
        {onDemote && (
          <button onClick={onDemote} disabled={busy || cannotDemote}
            title={isMe ? "Can't demote yourself" : isLastAdmin ? "Can't demote the last admin" : 'Demote to coach'}
            className="h-7 px-2 rounded-md border border-ink-200 hover:bg-ink-100 text-[11px] inline-flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed"
          ><ArrowDown className="w-3 h-3" /> Demote</button>
        )}
        {onPromote && (
          <button onClick={onPromote} disabled={busy}
            className="h-7 px-2 rounded-md border border-accent-200 bg-accent-50 text-accent-700 hover:bg-accent-100 text-[11px] inline-flex items-center gap-1 disabled:opacity-50"
          ><ArrowUp className="w-3 h-3" /> Promote</button>
        )}
        {onPermissions && (
          <button onClick={onPermissions} disabled={busy}
            title="Manage page access for this coach"
            className="h-7 px-2 rounded-md border border-accent-200 bg-accent-50 text-accent-700 hover:bg-accent-100 text-[11px] inline-flex items-center gap-1 disabled:opacity-30"
          >Permissions</button>
        )}
        <button onClick={onDelete} disabled={busy || cannotDelete}
          title={isMe ? "Can't delete yourself" : member.role === 'admin' && isLastAdmin ? "Can't delete the last admin" : 'Delete user'}
          className="h-7 px-2 rounded-md border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-[11px] inline-flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
          Delete
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Inline Permissions Modal — bundled here so no separate file is needed
// ============================================================================
const ALL_PERMISSIONS = [
  { key: 'students',   label: 'Students' },
  { key: 'emi',        label: 'EMI Tracker' },
  { key: 'progress',   label: 'Progress' },
  { key: 'follow-ups', label: 'Follow-ups' },
  { key: 'reminders',  label: 'Reminders' },
  { key: 'calls',      label: 'Call Queue' },
  { key: 'comments',   label: 'Comments' },
  { key: 'reports',    label: 'Reports' },
];

function InlinePermissionsModal({
  user, onClose, onSaved,
}: {
  user: TeamMember;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [perms, setPerms] = useState<Set<string>>(new Set(user.permissions ?? []));
  const [saving, setSaving] = useState(false);

  function toggle(k: string) {
    const next = new Set(perms);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setPerms(next);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/update-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, permissions: Array.from(perms) }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast('Permissions updated', 'success');
      onSaved();
    } catch (e: any) {
      toast(e.message ?? 'Failed to save', 'error');
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center px-4">
      <div onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="relative bg-white rounded-2xl shadow-pop w-full max-w-[460px] p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="text-[16px] font-semibold">Page access</div>
            <div className="text-[12px] text-ink-500 mt-0.5">{user.display_name || user.email}</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-md hover:bg-ink-100 grid place-items-center text-ink-500">x</button>
        </div>

        <div className="flex gap-1 mb-3 text-[11.5px]">
          <button onClick={() => setPerms(new Set(ALL_PERMISSIONS.map(p => p.key)))} className="px-2 py-1 rounded text-accent-700 hover:bg-accent-50 font-medium">Select all</button>
          <button onClick={() => setPerms(new Set())} className="px-2 py-1 rounded text-ink-500 hover:bg-ink-50 font-medium">Clear</button>
        </div>

        <div className="space-y-1.5 max-h-[360px] overflow-auto">
          {ALL_PERMISSIONS.map((p) => {
            const active = perms.has(p.key);
            return (
              <button
                key={p.key}
                onClick={() => toggle(p.key)}
                className={'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition ' +
                  (active ? 'bg-accent-50 border border-accent-200' : 'border border-ink-200 hover:bg-ink-50')}
              >
                <span className={'w-4 h-4 rounded grid place-items-center shrink-0 text-white text-[10px] font-bold ' +
                  (active ? 'bg-accent-600' : 'border-2 border-ink-300')}>
                  {active ? 'v' : ''}
                </span>
                <div className="text-[13px] font-medium text-ink-900">{p.label}</div>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 mt-5">
          <div className="text-[11.5px] text-ink-500 mr-auto">{perms.size} of {ALL_PERMISSIONS.length} selected</div>
          <button onClick={onClose} className="h-9 px-4 rounded-lg border border-ink-200 text-[13px] font-medium hover:bg-ink-50">Cancel</button>
          <button onClick={save} disabled={saving} className="h-9 px-5 rounded-lg bg-ink-900 text-white text-[13px] font-medium disabled:opacity-50 hover:bg-ink-800">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Centered Confirmation Dialog
// ============================================================================
function ConfirmDialog({
  title, message, confirmLabel, tone, onConfirm, onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  tone: 'danger' | 'warn' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const toneClass =
    tone === 'danger'  ? 'bg-rose-600 hover:bg-rose-700 text-white' :
    tone === 'warn'    ? 'bg-amber-600 hover:bg-amber-700 text-white' :
                         'bg-ink-900 hover:bg-ink-800 text-white';

  const iconBg =
    tone === 'danger'  ? 'bg-rose-50 text-rose-600' :
    tone === 'warn'    ? 'bg-amber-50 text-amber-600' :
                         'bg-accent-50 text-accent-600';

  return (
    <div className="fixed inset-0 z-[110] grid place-items-center px-4">
      <div onClick={onCancel} className="absolute inset-0 bg-black/50" />
      <div className="relative bg-white rounded-2xl shadow-pop w-full max-w-[400px] p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className={'w-10 h-10 rounded-full grid place-items-center shrink-0 ' + iconBg}>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 pt-1">
            <div className="text-[16px] font-semibold text-ink-900 leading-tight">{title}</div>
            <div className="text-[13px] text-ink-600 mt-1.5 leading-snug">{message}</div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            onClick={onCancel}
            className="h-9 px-4 rounded-lg border border-ink-200 text-[13px] font-medium text-ink-700 hover:bg-ink-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={'h-9 px-5 rounded-lg text-[13px] font-medium ' + toneClass}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}




function Card({ title, icon, desc, children }: { title: string; icon?: React.ReactNode; desc: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-ink-200/70 rounded-xl p-5">
      <div className="flex items-center gap-2">
        {icon}
        <div className="font-semibold text-[14px]">{title}</div>
      </div>
      <div className="text-[12.5px] text-ink-500 mt-0.5 mb-4">{desc}</div>
      {children}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-md text-[12.5px] font-medium transition ${active ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-ink-100'}`}
    >{children}</button>
  );
}

function InputField({
  label, value, onChange, placeholder, type = 'text',
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <label className="block">
      <div className="text-[12px] font-medium text-ink-700 mb-1.5">{label}</div>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full h-9 px-3 rounded-lg border border-ink-200 text-[13px] focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-100 bg-white"
      />
    </label>
  );
}