/**
 * Minimal in-memory TTL cache.
 *
 * NASA's DEMO_KEY is capped at 30 requests/hour and 50/day, and even a
 * personal key has a rate limit, so every route caches its upstream
 * response for a while instead of re-fetching on every dashboard refresh.
 *
 * This is process-local and resets on restart — fine for a portfolio
 * project with a single backend instance. If this ever needs to run
 * behind multiple server instances, swap this for something shared
 * (Redis, etc).
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

export async function cached<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const existing = store.get(key);
  if (existing && existing.expiresAt > now) {
    return existing.value as T;
  }

  const value = await fetcher();
  store.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

export const TTL = {
  ONE_HOUR: 60 * 60 * 1000,
  SIX_HOURS: 6 * 60 * 60 * 1000,
  ONE_DAY: 24 * 60 * 60 * 1000,
  THIRTY_SECONDS: 30 * 1000,
};
