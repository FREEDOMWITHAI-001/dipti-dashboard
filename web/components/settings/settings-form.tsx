'use client';

import { useState } from 'react';
import {
  Save, Eye, EyeOff, Check, ChevronDown, Sparkles, Mic,
  Info, Users, UserPlus, ShieldCheck, Loader2, AlertTriangle,
  Trash2, ArrowDown, ArrowUp,
} from 'lucide-react';
import { useToast } from '@/components/shell/toast-region';

type Provider = 'openai' | 'anthropic' | 'google' | 'groq' | 'openrouter';

type Status = {
  location_id: string | null;
  ai_provider: Provider;
  ghl_configured: boolean;       ghl_last4: string;
  openai_configured: boolean;    openai_last4: string;
  anthropic_configured: boolean; anthropic_last4: string;
  ai_configured: boolean;        ai_last4: string;
};

type TeamMember = { id: string; email: string; display_name: string; initials: string; role: string };

const PROVIDERS: Array<{ value: Provider; label: string; model: string; placeholder: string; helpUrl: string; supportsVoice: boolean }> = [
  { value: 'openai',     label: 'OpenAI',           model: 'GPT-4o-mini',           placeholder: 'sk-...',     helpUrl: 'https://platform.openai.com/api-keys',              supportsVoice: true  },
  { value: 'anthropic',  label: 'Anthropic Claude', model: 'Claude Haiku 4.5',      placeholder: 'sk-ant-...', helpUrl: 'https://console.anthropic.com/settings/keys',       supportsVoice: false },
  { value: 'google',     label: 'Google Gemini',    model: 'Gemini 1.5 Flash',      placeholder: 'AIza...',    helpUrl: 'https://aistudio.google.com/app/apikey',            supportsVoice: false },
  { value: 'groq',       label: 'Groq',             model: 'Llama 3.1 70B (fast)',  placeholder: 'gsk_...',    helpUrl: 'https://console.groq.com/keys',                     supportsVoice: true  },
  { value: 'openrouter', label: 'OpenRouter',       model: 'auto-routed',           placeholder: 'sk-or-...',  helpUrl: 'https://openrouter.ai/settings/keys',               supportsVoice: false },
];

export function SettingsForm({
  status, isAdmin, currentUserId, admins = [], coaches = [],
}: {
  status: Status;
  isAdmin: boolean;
  currentUserId: string | null;
  admins?: TeamMember[];
  coaches?: TeamMember[];
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [aiProvider, setAiProvider] = useState<Provider>(status.ai_provider ?? 'anthropic');
  const [form, setForm] = useState({
    ghl_location_id: '', ghl_pit_token: '', ai_api_key: '', openai_api_key: '',
  });

  const selectedProvider = PROVIDERS.find((p) => p.value === aiProvider) ?? PROVIDERS[1];
  const savedProviderSupportsVoice =
    PROVIDERS.find((p) => p.value === status.ai_provider)?.supportsVoice ?? false;
  const voiceAutoShared = savedProviderSupportsVoice && status.ai_configured;
  const voiceAutoProviderLabel =
    PROVIDERS.find((p) => p.value === status.ai_provider)?.label ?? 'AI provider';

  async function save() {
    if (!isAdmin) { toast('Admin role required to save settings', 'error'); return; }
    setSaving(true);
    try {
      const payload: any = { ai_provider: aiProvider };
      if (form.ghl_location_id.trim()) payload.ghl_location_id = form.ghl_location_id.trim();
      if (form.ghl_pit_token.trim())   payload.ghl_pit_token   = form.ghl_pit_token.trim();
      if (form.ai_api_key.trim())      payload.ai_api_key      = form.ai_api_key.trim();
      if (form.openai_api_key.trim())  payload.openai_api_key  = form.openai_api_key.trim();

      const res = await fetch('/api/settings/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      const { updated } = await res.json();
      toast(updated > 0 ? `Saved (${updated} field${updated > 1 ? 's' : ''})` : 'Nothing changed', 'success');
      setForm({ ghl_location_id: '', ghl_pit_token: '', ai_api_key: '', openai_api_key: '' });
      setTimeout(() => window.location.reload(), 600);
    } catch (e: any) { toast(e.message ?? 'Save failed', 'error'); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <Card title="AI assistant" icon={<Sparkles className="w-4 h-4 text-accent-700" />}
        desc="Powers the AI Progress summaries on every student. Pick a provider, then paste that provider's API key."
      >
        <div className="mb-3">
          <div className="text-[12px] font-medium text-ink-700 mb-1.5">Provider</div>
          <div className="relative">
            <select value={aiProvider} onChange={(e) => setAiProvider(e.target.value as Provider)}
              className="w-full h-9 pl-3 pr-9 rounded-lg border border-ink-200 bg-white text-[13px] focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-100 appearance-none"
            >
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label} · {p.model}{p.supportsVoice ? ' · 🎤' : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-ink-500 pointer-events-none" />
          </div>
          <div className="text-[11px] text-ink-500 mt-1.5">🎤 = also handles voice transcription</div>
        </div>
        <SecretField
          label={`${selectedProvider.label} API Key`}
          configured={status.ai_configured && status.ai_provider === aiProvider}
          last4={status.ai_last4}
          value={form.ai_api_key}
          shown={!!show.ai}
          onToggle={() => setShow((s) => ({ ...s, ai: !s.ai }))}
          onChange={(v) => setForm((f) => ({ ...f, ai_api_key: v }))}
          placeholder={selectedProvider.placeholder}
          helpUrl={selectedProvider.helpUrl}
        />
        {aiProvider !== status.ai_provider && (
          <div className="flex items-start gap-2 mt-3 text-[12px] text-amber-800 bg-amber-50 rounded-lg p-2.5">
            <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-amber-600" />
            <div>You changed the provider. Paste the new key above and click Save to switch.</div>
          </div>
        )}
      </Card>

      <Card title="Voice transcription" icon={<Mic className="w-4 h-4 text-emerald-700" />}
        desc="Powers the 🎤 mic button when logging calls and editing student backgrounds."
      >
        {voiceAutoShared ? (
          <div className="flex items-start gap-2 text-[12.5px] text-emerald-800 bg-emerald-50 rounded-lg p-3">
            <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-600" />
            <div>
              <div className="font-medium">Voice ready — using {voiceAutoProviderLabel} Whisper</div>
              <div className="text-[11.5px] text-emerald-700 mt-0.5">
                Your AI key above also handles voice. Nothing more to configure.
              </div>
            </div>
          </div>
        ) : status.ai_provider && !savedProviderSupportsVoice ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 text-[12.5px] text-amber-800 bg-amber-50 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600" />
              <div>
                <div className="font-medium">{voiceAutoProviderLabel} doesn't support voice</div>
                <div className="text-[11.5px] text-amber-700 mt-0.5">
                  Either paste a separate OpenAI Whisper key below, OR switch your AI provider above to <strong>OpenAI</strong> or <strong>Groq</strong> (both have 🎤).
                </div>
              </div>
            </div>
            <SecretField label="OpenAI Whisper key (separate)"
              configured={status.openai_configured} last4={status.openai_last4}
              value={form.openai_api_key} shown={!!show.openai}
              onToggle={() => setShow((s) => ({ ...s, openai: !s.openai }))}
              onChange={(v) => setForm((f) => ({ ...f, openai_api_key: v }))}
              placeholder="sk-..." helpUrl="https://platform.openai.com/api-keys"
            />
          </div>
        ) : (
          <details className="text-[12px]">
            <summary className="text-ink-500 cursor-pointer hover:text-ink-700">Paste a dedicated OpenAI Whisper key…</summary>
            <div className="mt-2">
              <SecretField label="OpenAI Whisper key (separate)"
                configured={status.openai_configured} last4={status.openai_last4}
                value={form.openai_api_key} shown={!!show.openai}
                onToggle={() => setShow((s) => ({ ...s, openai: !s.openai }))}
                onChange={(v) => setForm((f) => ({ ...f, openai_api_key: v }))}
                placeholder="sk-..." helpUrl="https://platform.openai.com/api-keys"
              />
            </div>
          </details>
        )}
      </Card>

      <Card title="GoHighLevel (optional)"
        desc="Only needed if you use Pull from GHL to bulk-import contacts. Reminders use webhook URLs and don't need this."
      >
        <div className="grid gap-3">
          <label className="block">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[12px] font-medium text-ink-700">Location ID</span>
              {status.location_id && (
                <span className="text-[11px] text-ink-500">Current: <span className="font-mono text-ink-700">{status.location_id}</span></span>
              )}
            </div>
            <input type="text" value={form.ghl_location_id}
              onChange={(e) => setForm((f) => ({ ...f, ghl_location_id: e.target.value }))}
              placeholder="e.g. abc123XYZ"
              className="w-full h-9 px-3 rounded-lg border border-ink-200 text-[13px] focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-100 bg-white"
            />
          </label>
          <SecretField label="Private Integration Token"
            configured={status.ghl_configured} last4={status.ghl_last4}
            value={form.ghl_pit_token} shown={!!show.ghl}
            onToggle={() => setShow((s) => ({ ...s, ghl: !s.ghl }))}
            onChange={(v) => setForm((f) => ({ ...f, ghl_pit_token: v }))}
            placeholder="pit-..." helpUrl="https://app.gohighlevel.com/settings/private-integrations"
          />
        </div>
      </Card>

      {isAdmin && (
        <TeamAccessCard
          admins={admins}
          coaches={coaches}
          currentUserId={currentUserId}
          toast={toast}
        />
      )}

      <Card title="Reminders" desc="Scheduled events, GHL webhook URLs, and per-event toggles.">
        <a href="/reminders" className="text-[13px] text-accent-700 font-medium hover:underline">
          Open reminder catalog →
        </a>
      </Card>

      <div className="flex items-center justify-end gap-3 pt-2">
        {!isAdmin && (
          <span className="text-[12px] text-amber-700">Read-only — admin role required to save.</span>
        )}
        <button onClick={save} disabled={saving || !isAdmin}
          className="h-9 px-4 rounded-lg bg-ink-900 text-white text-[13px] font-medium inline-flex items-center gap-2 disabled:opacity-50 hover:bg-ink-800"
        >
          <Save className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Team Access — manage admins & coaches with delete/demote/promote actions
// ============================================================================

function TeamAccessCard({
  admins, coaches, currentUserId, toast,
}: {
  admins: TeamMember[];
  coaches: TeamMember[];
  currentUserId: string | null;
  toast: (m: string, t?: 'success' | 'error' | 'info') => void;
}) {
  const [tab, setTab] = useState<'create' | 'promote'>('create');
  const [busyId, setBusyId] = useState<string | null>(null);

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
    if (!confirm(`Permanently delete ${label}? This cannot be undone.`)) return;
    setBusyId(m.id);
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: m.id }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast(`Deleted ${label}`, 'success');
      setTimeout(() => window.location.reload(), 600);
    } catch (e: any) { toast(e.message ?? 'Delete failed', 'error'); }
    finally { setBusyId(null); }
  }

  async function demote(m: TeamMember) {
    if (m.id === currentUserId) { toast("You can't demote yourself.", 'error'); return; }
    if (isLastAdmin) {
      toast("Can't demote the last admin — promote another user first.", 'error'); return;
    }
    if (!confirm(`Demote ${m.display_name || m.email} to coach?`)) return;
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
    if (!confirm(`Promote ${m.display_name || m.email} to admin?`)) return;
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
  member, isMe, busy, isLastAdmin, onDelete, onDemote, onPromote,
}: {
  member: TeamMember;
  isMe: boolean;
  busy: boolean;
  isLastAdmin: boolean;
  onDelete: () => void;
  onDemote?: () => void;
  onPromote?: () => void;
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
// Shared UI primitives
// ============================================================================

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
      className={`px-3 h-8 text-[12.5px] font-medium border-b-2 -mb-px inline-flex items-center gap-1.5 ${
        active ? 'border-accent-600 text-ink-900' : 'border-transparent text-ink-500 hover:text-ink-700'
      }`}
    >{children}</button>
  );
}

function InputField({
  label, value, onChange, placeholder, type = 'text',
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <label className="block">
      <div className="text-[11.5px] font-medium text-ink-700 mb-1">{label}</div>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} autoComplete="off"
        className="w-full h-9 px-3 rounded-lg border border-ink-200 text-[13px] focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-100 bg-white"
      />
    </label>
  );
}

function SecretField({
  label, configured, last4, value, shown, onToggle, onChange, placeholder, helpUrl,
}: {
  label: string;
  configured: boolean;
  last4: string;
  value: string;
  shown: boolean;
  onToggle: () => void;
  onChange: (v: string) => void;
  placeholder?: string;
  helpUrl?: string;
}) {
  return (
    <label className="block">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] font-medium text-ink-700">{label}</span>
        <div className="flex items-center gap-2">
          {helpUrl && (
            <a href={helpUrl} target="_blank" rel="noopener" className="text-[11px] text-ink-500 hover:text-accent-700 hover:underline">
              get key ↗
            </a>
          )}
          {configured ? (
            <span className="text-[11px] text-emerald-700 inline-flex items-center gap-1">
              <Check className="w-3 h-3" /> Configured · …<span className="font-mono">{last4}</span>
            </span>
          ) : (
            <span className="text-[11px] text-amber-700">Not configured</span>
          )}
        </div>
      </div>
      <div className="relative">
        <input
          type={shown ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          className="w-full h-9 pl-3 pr-9 rounded-lg border border-ink-200 text-[13px] font-mono focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-100 bg-white"
        />
        <button type="button" onClick={onToggle} tabIndex={-1}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-ink-500 hover:text-ink-800 rounded-md hover:bg-ink-100"
          aria-label={shown ? 'Hide' : 'Show'}
        >
          {shown ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </div>
    </label>
  );
}