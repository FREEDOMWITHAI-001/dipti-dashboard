'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const sb = supabaseBrowser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const next = params.get('next');
  const initialError = params.get('error');
  const banner = initialError === 'auth_unavailable'
    ? 'Your session expired or the auth service was briefly unavailable. Please sign in again.'
    : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const { error } = await sb.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setErr(friendlyAuthError(error.message));
      return;
    }
    const dest = next && next.startsWith('/') ? next : '/students';
    router.replace(dest as any);
    router.refresh();
  }

  return (
    <div className="min-h-screen grid place-items-center bg-ink-50 px-4">
      <div className="w-full max-w-[380px] bg-white border border-ink-200/70 rounded-2xl shadow-pop p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-lg bg-ink-900 text-white grid place-items-center font-semibold">D</div>
          <div>
            <div className="font-semibold">DVA Operations</div>
            <div className="text-[12px] text-ink-500">Sign in to continue</div>
          </div>
        </div>

        {banner && (
          <div className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-3">{banner}</div>
        )}

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="text-[12px] font-medium text-ink-700">Email</label>
            <input
              type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full h-10 px-3 rounded-lg border border-ink-200 focus:border-accent-500 focus:ring-2 focus:ring-accent-100 outline-none text-[13.5px]"
              placeholder="you@dva.com"
            />
          </div>
          <div>
            <label className="text-[12px] font-medium text-ink-700">Password</label>
            <input
              type="password" required value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full h-10 px-3 rounded-lg border border-ink-200 focus:border-accent-500 focus:ring-2 focus:ring-accent-100 outline-none text-[13.5px]"
              placeholder="••••••••"
            />
          </div>

          {err ? <div className="text-[12px] text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">{err}</div> : null}

          <Button type="submit" variant="primary" disabled={busy} className="w-full h-10 justify-center">
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <div className="mt-6 pt-5 border-t border-ink-100 text-[11.5px] text-ink-500 leading-relaxed">
          For first-time setup, an admin invites you via Supabase Auth.
          Coaches use the same login they use in GHL.
        </div>
      </div>
    </div>
  );
}

function friendlyAuthError(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes('email not confirmed')) {
    return 'Your email is not confirmed yet. Ask an admin to enable "Auto Confirm" on your Supabase user, or check your inbox for the confirmation link.';
  }
  if (lower.includes('invalid login credentials')) {
    return 'Email or password is incorrect.';
  }
  if (lower.includes('demo mode')) {
    return msg;
  }
  return msg;
}
