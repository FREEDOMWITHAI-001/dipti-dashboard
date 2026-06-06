import { supabaseServer } from '@/lib/supabase/server';
import { SettingsForm } from '@/components/settings/settings-form';
import { ReminderEventsTable } from '@/components/reminders/events-table';

export const dynamic = 'force-dynamic';

export default async function GhlSettingsPage() {
  const sb = supabaseServer();

  const [{ data: { user } }, { data: status }, { data: events }] = await Promise.all([
    sb.auth.getUser(),
    sb.from('v_settings_status').select('*').eq('id', 1).maybeSingle(),
    sb.from('reminder_events').select('*').order('id'),
  ]);

  let isAdmin = false;
  if (user) {
    const { data: profile } = await sb
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    isAdmin = (profile as any)?.role === 'admin';
  }

  const safeStatus = (status as any) ?? {
    location_id: null,
    ai_provider: 'anthropic',
    ghl_configured: false,       ghl_last4: '',
    openai_configured: false,    openai_last4: '',
    anthropic_configured: false, anthropic_last4: '',
    ai_configured: false,        ai_last4: '',
  };

  return (
    <div className="px-7 py-7 max-w-[900px]">
      <h1 className="text-[24px] font-semibold tracking-tight mb-1">GHL Integration</h1>
      <p className="text-[13.5px] text-ink-500 mb-6">GoHighLevel connection and the workflows each reminder triggers — including per-payment-type templates.</p>
      <SettingsForm
        status={safeStatus}
        isAdmin={isAdmin}
        currentUserId={user?.id ?? null}
        variant="ghl"
      />

      <div className="mt-8">
        <h2 className="text-[16px] font-semibold tracking-tight mb-1">Workflows</h2>
        <p className="text-[12.5px] text-ink-500 mb-3">
          Connect each reminder event to a GHL workflow / webhook URL. For EMI reminders you can also set a different workflow per payment type.
        </p>
        <ReminderEventsTable events={(events ?? []) as any} />
      </div>
    </div>
  );
}