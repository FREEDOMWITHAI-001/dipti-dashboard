import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { TeamAccessCard, type TeamMember } from '@/components/settings/team-access-card';
import { ShieldCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function PermissionsPage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await sb.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const isAdmin = (me as any)?.role === 'admin';
  if (!isAdmin) redirect('/students');

  // Fetch all team members
  let admins: TeamMember[] = [];
  let coaches: TeamMember[] = [];
  try {
    const admin = supabaseAdmin();
    const { data: profileRows } = await admin
      .from('profiles')
      .select('id, display_name, initials, role, permissions')
      .in('role', ['admin', 'coach']);

    if (profileRows && profileRows.length > 0) {
      const { data: usersResp } = await admin.auth.admin.listUsers({ perPage: 200 });
      const emailMap = new Map((usersResp?.users ?? []).map((u: any) => [u.id, u.email ?? '']));
      const all: TeamMember[] = profileRows.map((p: any) => ({
        id: p.id,
        email: emailMap.get(p.id) ?? '',
        display_name: p.display_name ?? '',
        initials: p.initials ?? '',
        role: p.role ?? 'coach',
        permissions: p.permissions ?? [],
      }));
      admins = all.filter((m) => m.role === 'admin');
      coaches = all.filter((m) => m.role === 'coach');
    }
  } catch (e: any) {
    console.error('[permissions] fetch failed:', e?.message);
  }

  return (
    <div className="px-7 py-7 max-w-[900px]">
      <div className="mb-6 flex items-center gap-2.5">
        <div className="w-10 h-10 rounded-xl bg-accent-50 grid place-items-center">
          <ShieldCheck className="w-5 h-5 text-accent-600" />
        </div>
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight leading-tight">Permissions</h1>
          <p className="text-[13.5px] text-ink-500 mt-0.5">Manage team members and their page access.</p>
        </div>
      </div>

      <TeamAccessCard
        admins={admins}
        coaches={coaches}
        currentUserId={user.id}
      />
    </div>
  );
}