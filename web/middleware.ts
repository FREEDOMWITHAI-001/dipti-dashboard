import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options?: any }[]) => {
          // When getUser() rotates an expired access token, write the refreshed
          // cookies onto BOTH the request and the response. Writing only to the
          // response (the old code) left the Server Component / API route that
          // runs AFTER this middleware reading the stale cookie from the request,
          // so it saw an expired token and returned 401 / redirected to /login —
          // the intermittent "unauthenticated" logouts on token expiry.
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const path = req.nextUrl.pathname;
  const isAppRoute = path === '/' || path.startsWith('/students') || path.startsWith('/emi')
    || path.startsWith('/reminders') || path.startsWith('/calls') || path.startsWith('/reports')
    || path.startsWith('/settings');

  if (isAppRoute && !user) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (path.startsWith('/login') && user) {
    const url = req.nextUrl.clone();
    url.pathname = '/students';
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/webhooks|api/cron).*)',
  ],
};
