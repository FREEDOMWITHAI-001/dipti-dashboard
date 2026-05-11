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

  let profile: { display_name: string; initials: string; role: string } | null = null;
  if (user) {
    const { data } = await sb.from('profiles').select('display_name, initials, role').eq('id', user.id).maybeSingle();
    profile = (data as any) ?? null;
    // Auto-create a stub profile if the trigger never ran (user predates it,
    // or trigger failed). Without this the user would be silently treated as
    // a coach with placeholder initials, which is confusing for admins.
    if (!profile) {
      const email = user.email ?? '';
      const stub = {
        id: user.id,
        display_name: email.split('@')[0] || 'User',
        initials: (email.slice(0, 2) || 'US').toUpperCase(),
        role: 'coach',
      };
      const { data: inserted } = await sb.from('profiles').insert(stub).select('display_name, initials, role').maybeSingle();
      profile = (inserted as any) ?? { display_name: stub.display_name, initials: stub.initials, role: stub.role };
    }
  }

  const sessionUser = user
    ? {
        email: user.email ?? '',
        displayName: profile?.display_name ?? (user.email ?? '').split('@')[0],
        initials: profile?.initials ?? (user.email ?? '').slice(0, 2).toUpperCase(),
        role: (profile?.role as 'coach' | 'admin') ?? 'coach',
      }
    : null;

  const badges = {
    emi: emiOverdue ?? 0,
    calls: callsQueue ?? 0,
  };

  return (
    <div className="h-screen w-screen flex">
      <Sidebar user={sessionUser} badges={badges} />
      <main className="flex-1 flex flex-col min-w-0">
        <Topbar user={sessionUser} />
        <section className="flex-1 overflow-auto">{children}</section>
      </main>
      <Suspense fallback={null}>
        <StudentSlideover />
      </Suspense>
    </div>
  );
}
