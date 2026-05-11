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

export async function ghlTriggerWorkflow(contactId: string, workflowId: string): Promise<any> {
  return ghl(`/contacts/${contactId}/workflow/${workflowId}`, { method: 'POST' });
}

export { GhlError };
