import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getPaymentLink, CashfreeError } from '@/lib/cashfree/client';
import { istDateString } from '@/lib/utils';

export const runtime = 'nodejs';

// Reconcile an EMI's payment state with Cashfree's LIVE link status.
//
// The webhook (/api/cashfree/webhook) is the primary path that flips an EMI to
// "paid", but it only fires if Cashfree can reach a public callback URL AND a
// webhook secret is configured. In local/dev or a misconfigured setup the
// student can complete the payment (Cashfree shows "already complete") while the
// app still shows the installment as "upcoming". This endpoint pulls the link's
// current status on demand and marks the EMI paid when Cashfree reports PAID —
// using the same atomic, idempotent update the webhook uses.
export async function POST(req: Request) {
  try {
    const { emiId } = await req.json();
    if (!emiId) {
      return NextResponse.json({ ok: false, error: 'emiId required' }, { status: 400 });
    }

    // Auth + permission (admin, or coach with EMI permission) — mirrors generate-link.
    const sb = supabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Not signed in' }, { status: 401 });
    }
    const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).maybeSingle();
    const isAdmin = (profile as any)?.role === 'admin';
    if (!isAdmin) {
      const { data: profileFull } = await sb.from('profiles').select('permissions').eq('id', user.id).maybeSingle();
      const perms = (profileFull as any)?.permissions ?? [];
      if (!perms.includes('emi')) {
        return NextResponse.json({ ok: false, error: 'Forbidden — admin or EMI permission required' }, { status: 403 });
      }
    }

    const admin = supabaseAdmin();

    // Load the EMI
    const { data: emi } = await admin
      .from('emi_schedule')
      .select('id, student_id, status, amount, cashfree_link_id')
      .eq('id', emiId)
      .maybeSingle();
    if (!emi) {
      return NextResponse.json({ ok: false, error: 'EMI not found' }, { status: 404 });
    }
    if ((emi as any).status === 'paid') {
      return NextResponse.json({ ok: true, status: 'PAID', marked_paid: false, already_paid: true });
    }
    const linkId = (emi as any).cashfree_link_id as string | null;
    if (!linkId) {
      return NextResponse.json({ ok: true, status: null, marked_paid: false, note: 'No Cashfree link on this EMI' });
    }

    // Load Cashfree credentials
    const { data: settings } = await admin
      .from('ghl_settings')
      .select('cashfree_app_id, cashfree_secret_key, cashfree_env')
      .eq('id', 1)
      .maybeSingle();
    const appId = (settings as any)?.cashfree_app_id;
    const secretKey = (settings as any)?.cashfree_secret_key;
    const env = (settings as any)?.cashfree_env ?? 'sandbox';
    if (!appId || !secretKey) {
      return NextResponse.json({
        ok: false,
        error: 'Cashfree not configured. Add App ID and Secret Key in Settings → GHL Integration.',
      }, { status: 400 });
    }

    // Pull the live link from Cashfree
    let link;
    try {
      link = await getPaymentLink({ appId, secretKey, env }, linkId);
    } catch (e: any) {
      await admin.from('cashfree_events').insert({
        emi_id: emiId,
        student_id: (emi as any).student_id,
        event_type: 'link_status_fetch_failed',
        cashfree_link_id: linkId,
        error: e?.message ?? 'unknown',
      } as any);
      return NextResponse.json({
        ok: false,
        error: e instanceof CashfreeError ? e.message : 'Failed to fetch link status',
      }, { status: 502 });
    }

    const linkStatus = (link as any).link_status ?? null;

    // Always reflect the latest link status on the EMI.
    if (linkStatus) {
      await admin.from('emi_schedule').update({
        cashfree_link_status: linkStatus,
      } as any).eq('id', emiId);
    }

    let markedPaid = false;
    if (linkStatus === 'PAID') {
      // Atomic + idempotent: only flips a not-yet-paid row, so a racing webhook
      // and a manual sync can't both write a duplicate audit row.
      const { data: updatedRows } = await admin
        .from('emi_schedule')
        .update({
          status: 'paid',
          paid_date: istDateString(),
          payment_mode: 'Cashfree',
        } as any)
        .eq('id', emiId)
        .neq('status', 'paid')
        .select('id');

      if (updatedRows && updatedRows.length > 0) {
        markedPaid = true;
        await admin.from('cashfree_events').insert({
          emi_id: emiId,
          student_id: (emi as any).student_id,
          event_type: 'payment_success',
          cashfree_link_id: linkId,
          payload: { amount: (emi as any).amount, marked_paid: true, via: 'sync-status' },
        } as any);
      }
    }

    return NextResponse.json({ ok: true, status: linkStatus, marked_paid: markedPaid });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Internal error' }, { status: 500 });
  }
}
