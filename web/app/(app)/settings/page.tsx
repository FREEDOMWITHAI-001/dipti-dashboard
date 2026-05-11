import { supabaseServer } from '@/lib/supabase/server';
import { SettingsForm } from '@/components/settings/settings-form';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const sb = supabaseServer();

  const [{ data: { user } }, { data: status }] = await Promise.all([
    sb.auth.getUser(),
    sb.from('v_settings_status').select('*').eq('id', 1).maybeSingle(),
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
    ghl_configured: false,       ghl_last4: '',
    openai_configured: false,    openai_last4: '',
    anthropic_configured: false, anthropic_last4: '',
  };

  return (
    <div className="px-7 py-7 max-w-[900px]">
      <h1 className="text-[24px] font-semibold tracking-tight mb-1">Settings</h1>
      <p className="text-[13.5px] text-ink-500 mb-6">Workspace-level configuration.</p>
      <SettingsForm status={safeStatus} isAdmin={isAdmin} />
    </div>
  );
}
