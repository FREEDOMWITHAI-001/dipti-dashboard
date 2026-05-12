import { rateLimit } from '@/lib/rate-limit';
import { sleep } from '@/lib/utils';
import { getRuntimeSettings } from '@/lib/settings';
import { GhlError, type GhlContact, type GhlContactsResponse } from './types';

const BASE = 'https://services.leadconnectorhq.com';

async function ghl(path: string, opts: RequestInit = {}): Promise<any> {
  const { token, locationId } = await getRuntimeSettings();
  if (!token) {
    throw new GhlError(401, 'GHL_PIT_TOKEN not configured. Save it in Settings → GoHighLevel.');
  }
  await rateLimit('ghl');

  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      Version: '2021-07-28',
      'Content-Type': 'application/json',
      ...(locationId ? { 'Location-Id': locationId } : {}),
      ...(opts.headers ?? {}),
    },
  });

  if (res.status === 429) {
    const retry = Number(res.headers.get('retry-after') ?? 1);
    await sleep(retry * 1000);
    return ghl(path, opts);
  }
  if (!res.ok) {
    throw new GhlError(res.status, await res.text());
  }
  return res.json();
}

export async function ghlSearchContactsByTag(
  tag: string, limit = 100, startAfterId?: string
): Promise<GhlContactsResponse> {
  const { locationId } = await getRuntimeSettings();
  if (!locationId) throw new GhlError(400, 'GHL_LOCATION_ID not configured.');

  const params = new URLSearchParams({
    locationId,
    limit: String(limit),
    query: tag,
  });
  if (startAfterId) params.set('startAfterId', startAfterId);
  return ghl(`/contacts/?${params.toString()}`);
}

export async function ghlUpsertContact(payload: {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  tags?: string[];
  customFields?: Array<{ key: string; value: string }>;
}): Promise<{ contact?: GhlContact }> {
  const { locationId } = await getRuntimeSettings();
  return ghl('/contacts/upsert', {
    method: 'POST',
    body: JSON.stringify({ ...payload, locationId }),
  });
}

// Trigger a GHL workflow. Supports two modes:
//
//  1. WEBHOOK URL (preferred, simpler):
//     workflowOrUrl = "https://services.leadconnectorhq.com/hooks/.../webhook-trigger/..."
//     We POST the payload directly to that URL. No PIT token needed, no contactId
//     needed — GHL identifies/creates the contact from the payload itself.
//
//  2. WORKFLOW ID (legacy, requires PIT token + ghl_contact_id):
//     workflowOrUrl = "abc-123-def-..."
//     We call POST /contacts/{contactId}/workflow/{workflowId} with eventStartTime.
//
// The function auto-detects which mode based on whether the value starts with "http".
export async function ghlTriggerWorkflow(
  contactId: string | null,
  workflowOrUrl: string,
  payload: Record<string, unknown> = {}
): Promise<any> {
  // --- Mode 1: Webhook URL ---
  if (workflowOrUrl.startsWith('http://') || workflowOrUrl.startsWith('https://')) {
    await rateLimit('ghl');
    const res = await fetch(workflowOrUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new GhlError(res.status, text || `webhook returned ${res.status}`);
    }
    // GHL webhooks often return 200 with empty body or `{}`.
    return await res.json().catch(() => ({ ok: true }));
  }

  // --- Mode 2: Legacy workflow ID via REST API ---
  if (!contactId) {
    throw new GhlError(400, 'ghl_contact_id required when triggering by workflow ID. Use a webhook URL instead, or run Pull from GHL on the student.');
  }
  return ghl(`/contacts/${contactId}/workflow/${workflowOrUrl}`, {
    method: 'POST',
    body: JSON.stringify({
      eventStartTime: new Date().toISOString(),
    }),
  });
}

export { GhlError };