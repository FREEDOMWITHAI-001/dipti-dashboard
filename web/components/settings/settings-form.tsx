'use client';

import { useState } from 'react';
import { Save, Eye, EyeOff, Check } from 'lucide-react';
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

export function SettingsForm({ status, isAdmin }: { status: Status; isAdmin: boolean }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState({
    ghl_location_id:   '',
    ghl_pit_token:     '',
    openai_api_key:    '',
    anthropic_api_key: '',
  });

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

function Card({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-ink-200/70 rounded-xl p-5">
      <div className="font-semibold text-[14px]">{title}</div>
      <div className="text-[12.5px] text-ink-500 mt-0.5 mb-4">{desc}</div>
      {children}
    </div>
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
