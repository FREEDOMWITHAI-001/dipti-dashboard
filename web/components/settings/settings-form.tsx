'use client';

import { useState } from 'react';
import { Save, Eye, EyeOff, Check, ShieldCheck, UserPlus, Loader2, UserCog } from 'lucide-react';
import { useToast } from '@/components/shell/toast-region';

type Status = {
  location_id: string | null;
  ghl_configured: boolean;
  ghl_last4: string;
  openai_configured: boolean;
  openai_last4: string;
  anthropic_configured: boolean;
  anthropic_last4: string;
};

type AdminRow = { id: string; display_name: string; email: string };

export function SettingsForm({
  status, isAdmin, admins, currentUserId,
}: {
  status: Status;
  isAdmin: boolean;
  admins: AdminRow[];
  currentUserId: string | null;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState({
    ghl_location_id:   '',
    ghl_pit_token:     '',
    openai_api_key:    '',
    anthropic_api_key: '',
  });

  // Promote existing user state
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [promoting, setPromoting] = useState(false);

  // Create new coach state
  const [coachForm, setCoachForm] = useState({
    email: '',
    password: '',
    display_name: '',
    initials: '',
    make_admin: false,
  });
  const [creating, setCreating] = useState(false);

  async function save() {
    if (!isAdmin) {
      toast('Admin role required to save settings', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/settings/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await res.text());
      const { updated } = await res.json();
      toast(updated > 0 ? `Saved (${updated} field${updated > 1 ? 's' : ''})` : 'Nothing to save', 'success');
      setForm({ ghl_location_id: '', ghl_pit_token: '', openai_api_key: '', anthropic_api_key: '' });
      setTimeout(() => window.location.reload(), 600);
    } catch (e: any) {
      toast(e.message ?? 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function addAdmin() {
    const email = newAdminEmail.trim().toLowerCase();
    if (!email) { toast('Enter an email', 'error'); return; }
    if (!isAdmin) { toast('Admin role required', 'error'); return; }
    setPromoting(true);
    try {
      const res = await fetch('/api/admin/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || 'Failed');
      const data = JSON.parse(text);
      toast(
        data.alreadyAdmin
          ? `${email} is already an admin.`
          : `${email} is now an admin.`,
        'success'
      );
      setNewAdminEmail('');
      setTimeout(() => window.location.reload(), 600);
    } catch (e: any) {
      toast(e.message ?? 'Could not promote user', 'error');
    } finally {
      setPromoting(false);
    }
  }

  async function createCoach() {
    const email = coachForm.email.trim().toLowerCase();
    const password = coachForm.password.trim();
    if (!email) { toast('Enter an email', 'error'); return; }
    if (password.length < 6) { toast('Password must be at least 6 characters', 'error'); return; }
    if (!isAdmin) { toast('Admin role required', 'error'); return; }
    setCreating(true);
    try {
      const res = await fetch('/api/admin/create-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          display_name: coachForm.display_name.trim(),
          initials: coachForm.initials.trim(),
          make_admin: coachForm.make_admin,
        }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || 'Failed');
      const data = JSON.parse(text);
      toast(
        `${data.email} created as ${data.role}. Share the password with them.`,
        'success'
      );
      setCoachForm({ email: '', password: '', display_name: '', initials: '', make_admin: false });
      setTimeout(() => window.location.reload(), 800);
    } catch (e: any) {
      toast(e.message ?? 'Could not create user', 'error');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card
        title="GoHighLevel"
        desc="Private Integration token, location ID, and field mapping. Stored server-side, never returned to the browser in plaintext."
      >
        <div className="grid gap-3">
          <Field
            label="Location ID"
            current={status.location_id ?? null}
            value={form.ghl_location_id}
            onChange={(v) => setForm((f) => ({ ...f, ghl_location_id: v }))}
            placeholder="e.g. abc123XYZ"
          />
          <SecretField
            label="Private Integration Token"
            configured={status.ghl_configured}
            last4={status.ghl_last4}
            value={form.ghl_pit_token}
            shown={!!show.ghl}
            onToggle={() => setShow((s) => ({ ...s, ghl: !s.ghl }))}
            onChange={(v) => setForm((f) => ({ ...f, ghl_pit_token: v }))}
            placeholder="paste new token to replace"
          />
        </div>
      </Card>

      <Card
        title="AI services"
        desc="Voice transcription (Whisper) and call briefing (Claude Haiku). App degrades gracefully if missing."
      >
        <div className="grid gap-3">
          <SecretField
            label="OpenAI API Key"
            configured={status.openai_configured}
            last4={status.openai_last4}
            value={form.openai_api_key}
            shown={!!show.openai}
            onToggle={() => setShow((s) => ({ ...s, openai: !s.openai }))}
            onChange={(v) => setForm((f) => ({ ...f, openai_api_key: v }))}
            placeholder="sk-..."
          />
          <SecretField
            label="Anthropic API Key"
            configured={status.anthropic_configured}
            last4={status.anthropic_last4}
            value={form.anthropic_api_key}
            shown={!!show.anthropic}
            onToggle={() => setShow((s) => ({ ...s, anthropic: !s.anthropic }))}
            onChange={(v) => setForm((f) => ({ ...f, anthropic_api_key: v }))}
            placeholder="sk-ant-..."
          />
        </div>
      </Card>

      {/* === Team access card === */}
      <Card
        title="Team access"
        desc="Create new coaches, promote existing users to admin, and see who has admin access."
      >
        <div className="space-y-5">
          {/* Current admin list */}
          <div>
            <div className="text-[12px] font-medium text-ink-700 mb-2">Current admins ({admins.length})</div>
            {admins.length === 0 ? (
              <div className="text-[12.5px] text-ink-500">None — promote a user below.</div>
            ) : (
              <ul className="divide-y divide-ink-100 border border-ink-200/70 rounded-lg overflow-hidden">
                {admins.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-3 py-2 text-[13px]">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{a.display_name || '(no name)'}</div>
                      <div className="text-[11.5px] text-ink-500 truncate font-mono">{a.email || a.id}</div>
                    </div>
                    {currentUserId === a.id && (
                      <span className="text-[10.5px] font-medium text-ink-500 bg-ink-100 px-1.5 py-0.5 rounded">
                        You
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Create a new coach */}
          <div className="border-t border-ink-100 pt-4">
            <div className="text-[12px] font-medium text-ink-700 mb-2 flex items-center gap-1.5">
              <UserCog className="w-3.5 h-3.5 text-ink-500" />
              Create a new coach
            </div>
            <p className="text-[11.5px] text-ink-500 mb-2.5">
              Creates a sign-in account for a new team member. They can log in immediately with the password you set.
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <SmallField label="Email">
                <input
                  type="email"
                  value={coachForm.email}
                  onChange={(e) => setCoachForm((f) => ({ ...f, email: e.target.value }))}
                  disabled={!isAdmin || creating}
                  placeholder="coach@dva.com"
                  className={inputCls}
                />
              </SmallField>
              <SmallField label="Password (min 6 chars)">
                <div className="relative">
                  <input
                    type={show.newpw ? 'text' : 'password'}
                    value={coachForm.password}
                    onChange={(e) => setCoachForm((f) => ({ ...f, password: e.target.value }))}
                    disabled={!isAdmin || creating}
                    placeholder="••••••••"
                    className={inputCls + ' pr-9'}
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => ({ ...s, newpw: !s.newpw }))}
                    tabIndex={-1}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-ink-500 hover:text-ink-800 rounded-md hover:bg-ink-100"
                    aria-label={show.newpw ? 'Hide' : 'Show'}
                  >
                    {show.newpw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </SmallField>
              <SmallField label="Display name (optional)">
                <input
                  type="text"
                  value={coachForm.display_name}
                  onChange={(e) => setCoachForm((f) => ({ ...f, display_name: e.target.value }))}
                  disabled={!isAdmin || creating}
                  placeholder="auto from email"
                  className={inputCls}
                />
              </SmallField>
              <SmallField label="Initials (optional)">
                <input
                  type="text"
                  value={coachForm.initials}
                  onChange={(e) => setCoachForm((f) => ({ ...f, initials: e.target.value.toUpperCase().slice(0, 3) }))}
                  disabled={!isAdmin || creating}
                  placeholder="DV"
                  maxLength={3}
                  className={inputCls}
                />
              </SmallField>
            </div>
            <div className="flex items-center justify-between mt-2.5">
              <label className="flex items-center gap-2 text-[12px] text-ink-700 select-none">
                <input
                  type="checkbox"
                  checked={coachForm.make_admin}
                  onChange={(e) => setCoachForm((f) => ({ ...f, make_admin: e.target.checked }))}
                  disabled={!isAdmin || creating}
                  className="accent-accent-600"
                />
                Also make admin
              </label>
              <button
                onClick={createCoach}
                disabled={!isAdmin || creating || !coachForm.email || coachForm.password.length < 6}
                className="h-9 px-3 rounded-lg bg-ink-900 text-white text-[13px] font-medium inline-flex items-center gap-2 disabled:opacity-50 hover:bg-ink-800"
              >
                {creating
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating…</>
                  : <><UserCog className="w-3.5 h-3.5" /> Create coach</>}
              </button>
            </div>
          </div>

          {/* Promote existing user to admin */}
          <div className="border-t border-ink-100 pt-4">
            <div className="text-[12px] font-medium text-ink-700 mb-1.5 flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5 text-ink-500" />
              Promote an existing user to admin
            </div>
            <p className="text-[11.5px] text-ink-500 mb-2.5">
              The user must already have an account. To create a brand-new admin, use the form above with the "Also make admin" box checked.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="email"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                placeholder="user@dva.com"
                disabled={!isAdmin || promoting}
                onKeyDown={(e) => { if (e.key === 'Enter' && newAdminEmail.trim() && isAdmin) addAdmin(); }}
                className={inputCls + ' flex-1'}
              />
              <button
                onClick={addAdmin}
                disabled={!isAdmin || promoting || !newAdminEmail.trim()}
                className="h-9 px-3 rounded-lg bg-ink-900 text-white text-[13px] font-medium inline-flex items-center gap-2 disabled:opacity-50 hover:bg-ink-800"
              >
                {promoting
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Adding…</>
                  : <><UserPlus className="w-3.5 h-3.5" /> Promote to admin</>}
              </button>
            </div>
          </div>

          {!isAdmin && (
            <div className="text-[11.5px] text-amber-700">
              Only existing admins can manage team access.
            </div>
          )}
        </div>
      </Card>

      <Card title="Reminders" desc="Scheduled events, GHL workflow mappings, and per-event toggles.">
        <a href="/reminders" className="text-[13px] text-accent-700 font-medium hover:underline">
          Open reminder catalog →
        </a>
      </Card>

      <div className="flex items-center justify-end gap-3 pt-2">
        {!isAdmin && (
          <span className="text-[12px] text-amber-700">Read-only — admin role required to save.</span>
        )}
        <button
          onClick={save}
          disabled={saving || !isAdmin}
          className="h-9 px-4 rounded-lg bg-ink-900 text-white text-[13px] font-medium inline-flex items-center gap-2 disabled:opacity-50 hover:bg-ink-800"
        >
          <Save className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}

const inputCls = 'w-full h-9 px-3 rounded-lg border border-ink-200 text-[13px] focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-100 bg-white disabled:bg-ink-50 disabled:text-ink-400';

function Card({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-ink-200/70 rounded-xl p-5">
      <div className="font-semibold text-[14px]">{title}</div>
      <div className="text-[12.5px] text-ink-500 mt-0.5 mb-4">{desc}</div>
      {children}
    </div>
  );
}

function SmallField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[11px] font-medium text-ink-700 mb-1">{label}</div>
      {children}
    </label>
  );
}

function Field({
  label, current, value, onChange, placeholder,
}: {
  label: string;
  current: string | null;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] font-medium text-ink-700">{label}</span>
        {current && (
          <span className="text-[11px] text-ink-500 inline-flex items-center gap-1">
            <Check className="w-3 h-3 text-emerald-600" />
            Current: <span className="font-mono">{current}</span>
          </span>
        )}
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-9 px-3 rounded-lg border border-ink-200 text-[13px] font-mono focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-100 bg-white"
      />
    </label>
  );
}

function SecretField({
  label, configured, last4, value, shown, onToggle, onChange, placeholder,
}: {
  label: string;
  configured: boolean;
  last4: string;
  value: string;
  shown: boolean;
  onToggle: () => void;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] font-medium text-ink-700">{label}</span>
        {configured ? (
          <span className="text-[11px] text-emerald-700 inline-flex items-center gap-1">
            <Check className="w-3 h-3" /> Configured · ends in <span className="font-mono">…{last4}</span>
          </span>
        ) : (
          <span className="text-[11px] text-amber-700">Not configured</span>
        )}
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
        <button
          type="button"
          onClick={onToggle}
          tabIndex={-1}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-ink-500 hover:text-ink-800 rounded-md hover:bg-ink-100"
          aria-label={shown ? 'Hide' : 'Show'}
        >
          {shown ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </div>
    </label>
  );
}