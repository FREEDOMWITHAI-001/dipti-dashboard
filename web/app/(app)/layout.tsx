import { Sidebar } from '@/components/shell/sidebar';
import { Topbar } from '@/components/shell/topbar';
import { StudentSlideover } from '@/components/students/student-slideover';
import { Suspense } from 'react';
import { supabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sb = supabaseServer();

  const [{ data: { user } }, { count: emiOverdue }, { count: callsQueue }] = await Promise.all([
    sb.auth.getUser(),
    sb.from('emi_schedule').select('id', { count: 'exact', head: true }).eq('status', 'overdue'),
    sb.from('v_students_silent_30d').select('id', { count: 'exact', head: true }),
  ]);

  let profile: { display_name: string; initials: string; role: string; permissions: string[] } | null = null;
  if (user) {
    const { data } = await sb.from('profiles').select('display_name, initials, role, permissions').eq('id', user.id).maybeSingle();
    profile = (data as any) ?? null;
    if (!profile) {
      const email = user.email ?? '';
      const stub = {
        id: user.id,
        display_name: email.split('@')[0] || 'User',
        initials: (email.slice(0, 2) || 'US').toUpperCase(),
        role: 'coach',
        permissions: [],
      };
      const { data: inserted } = await sb.from('profiles').insert(stub).select('display_name, initials, role, permissions').maybeSingle();
      profile = (inserted as any) ?? { display_name: stub.display_name, initials: stub.initials, role: stub.role, permissions: stub.permissions };
    }
  }

  const sessionUser = user
    ? {
        email: user.email ?? '',
        displayName: profile?.display_name ?? (user.email ?? '').split('@')[0],
        initials: profile?.initials ?? (user.email ?? '').slice(0, 2).toUpperCase(),
        role: (profile?.role as 'coach' | 'admin') ?? 'coach',
        permissions: profile?.permissions ?? [],
      }
    : null;

  const badges = {
    emi: emiOverdue ?? 0,
    calls: callsQueue ?? 0,
  };

  return (
    <div className="h-screen flex bg-ink-50/30 overflow-hidden">
      <Sidebar user={sessionUser} badges={badges} />
      <div className="flex-1 flex flex-col min-w-0 h-screen">
        <Topbar user={sessionUser} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden">{children}</main>
      </div>
      <Suspense>
        <StudentSlideover />
      </Suspense>
    </div>
  );
}