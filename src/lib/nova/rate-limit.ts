/**
 * A minimal in-memory token bucket, one per client key (IP or user id).
 * Process-local like the health tracker — fine for a single-instance MVP;
 * a serverless deployment with multiple concurrent instances would need a
 * shared store (e.g. Supabase or Upstash) for this to hold across instances.
 */

interface Bucket {
  tokens: number;
  lastRefillMs: number;
}

const buckets = new Map<string, Bucket>();

const MAX_TOKENS = 20;
const REFILL_PER_MS = MAX_TOKENS / 60_000; // full bucket every 60s

export function isRateLimited(key: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { tokens: MAX_TOKENS, lastRefillMs: now };

  const elapsed = now - bucket.lastRefillMs;
  bucket.tokens = Math.min(MAX_TOKENS, bucket.tokens + elapsed * REFILL_PER_MS);
  bucket.lastRefillMs = now;

  if (bucket.tokens < 1) {
    buckets.set(key, bucket);
    return true;
  }

  bucket.tokens -= 1;
  buckets.set(key, bucket);
  return false;
}
