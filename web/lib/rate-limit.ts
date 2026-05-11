// Simple in-memory token bucket for outbound GHL calls.
// Lives in serverless function memory — fine for the scale described in the docs.

const buckets = new Map<string, { tokens: number; updatedAt: number }>();

const LIMITS: Record<string, { capacity: number; refillPerSec: number }> = {
  ghl: { capacity: 8, refillPerSec: 8 },   // 8 req/sec ceiling
};

export async function rateLimit(bucket: string): Promise<void> {
  const cfg = LIMITS[bucket] ?? { capacity: 10, refillPerSec: 10 };
  const now = Date.now();
  let b = buckets.get(bucket);
  if (!b) {
    b = { tokens: cfg.capacity, updatedAt: now };
    buckets.set(bucket, b);
  }
  const elapsed = (now - b.updatedAt) / 1000;
  b.tokens = Math.min(cfg.capacity, b.tokens + elapsed * cfg.refillPerSec);
  b.updatedAt = now;

  if (b.tokens >= 1) {
    b.tokens -= 1;
    return;
  }
  const wait = ((1 - b.tokens) / cfg.refillPerSec) * 1000;
  await new Promise((res) => setTimeout(res, wait + 10));
  b.tokens = 0;
  b.updatedAt = Date.now();
}
