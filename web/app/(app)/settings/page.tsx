import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { SettingsForm } from '@/components/settings/settings-form';
import { BackButton } from '@/components/ui/back-button';

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

  // Fetch the list of current admins (name + email) for display.
  // Uses the service-role admin client so we can join auth.users emails.
  let admins: { id: string; display_name: string; email: string }[] = [];
  try {
    const admin = supabaseAdmin();
    const { data: adminProfiles } = await admin
      .from('profiles')
      .select('id, display_name')
      .eq('role', 'admin')
      .order('display_name');

    if (adminProfiles && adminProfiles.length > 0) {
      const { data: usersPage } = await admin.auth.admin.listUsers({
        page: 1, perPage: 1000,
      });
      const emailById = new Map<string, string>(
        (usersPage?.users ?? []).map((u: any) => [u.id, u.email ?? ''])
      );
      admins = adminProfiles.map((p: any) => ({
        id: p.id,
        display_name: p.display_name,
        email: emailById.get(p.id) ?? '',
      }));
    }
  } catch {
    // If the admin client isn't configured, just show an empty list.
    admins = [];
  }

  const safeStatus = (status as any) ?? {
    location_id: null,
    ghl_configured: false,       ghl_last4: '',
    openai_configured: false,    openai_last4: '',
    anthropic_configured: false, anthropic_last4: '',
  };

  return (
    <div className="px-7 py-7 max-w-[900px]">
      <BackButton fallbackHref="/students" label="Back" />
      <h1 className="text-[24px] font-semibold tracking-tight mb-1">Settings</h1>
      <p className="text-[13.5px] text-ink-500 mb-6">Workspace-level configuration.</p>
      <SettingsForm status={safeStatus} isAdmin={isAdmin} admins={admins} currentUserId={user?.id ?? null} />
    </div>
  );
}