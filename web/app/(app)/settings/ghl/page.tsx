import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
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
    ai_provider: 'anthropic',
    ghl_configured: false,       ghl_last4: '',
    openai_configured: false,    openai_last4: '',
    anthropic_configured: false, anthropic_last4: '',
    ai_configured: false,        ai_last4: '',
  };

  // Fetch every team member (admin + coach) so the Team Access card can
  // show actions on each. Uses service-role because auth.users is locked
  // down by RLS.
  type TeamMember = { id: string; email: string; display_name: string; initials: string; role: string };
  let admins: TeamMember[] = [];
  let coaches: TeamMember[] = [];
  if (isAdmin) {
    try {
      const admin = supabaseAdmin();
      const { data: profileRows, error: pErr } = await admin
        .from('profiles')
        .select('id, display_name, initials, role, permissions')
        .in('role', ['admin', 'coach']);
      if (pErr) {
        console.error('[settings] profiles fetch failed:', pErr.message);
      } else if (profileRows && profileRows.length > 0) {
        const { data: usersResp, error: uErr } = await admin.auth.admin.listUsers({ perPage: 200 });
        if (uErr) console.error('[settings] listUsers failed:', uErr.message);
        const emailMap = new Map((usersResp?.users ?? []).map((u: any) => [u.id, u.email ?? '']));
        const all: TeamMember[] = profileRows.map((p: any) => ({
          id: p.id,
          email: emailMap.get(p.id) ?? '',
          display_name: p.display_name ?? '',
          initials: p.initials ?? '',
          role: p.role ?? 'coach',
          permissions: p.permissions ?? [],
        }));
        admins  = all.filter((m) => m.role === 'admin');
        coaches = all.filter((m) => m.role === 'coach');
      }
    } catch (e: any) {
      console.error('[settings] admin fetch threw:', e?.message);
    }
  }

  return (
    <div className="px-7 py-7 max-w-[900px]">
      <h1 className="text-[24px] font-semibold tracking-tight mb-1">Settings</h1>
      <p className="text-[13.5px] text-ink-500 mb-6">Workspace-level configuration.</p>
      <SettingsForm
        status={safeStatus}
        isAdmin={isAdmin}
        currentUserId={user?.id ?? null}
        admins={admins}
        coaches={coaches}
      />
    </div>
  );
}