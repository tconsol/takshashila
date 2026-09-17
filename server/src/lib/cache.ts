import { getRedisClient } from '../config/redis';
import { logger } from './logger';

/**
 * Lightweight read-through cache.
 * Uses Redis when reachable; falls back to a small in-process Map so a Redis
 * outage never breaks requests. Keeps repeated reads off MongoDB → lower Atlas
 * read ops + faster responses + smaller compute bill.
 */
const mem = new Map<string, { v: unknown; exp: number }>();

export async function cached<T>(key: string, ttlSeconds: number, produce: () => Promise<T>): Promise<T> {
  // 1) in-memory fast path
  const hit = mem.get(key);
  if (hit && hit.exp > Date.now()) return hit.v as T;

  // 2) Redis
  try {
    const redis = getRedisClient();
    const raw = await redis.get(key);
    if (raw) {
      const v = JSON.parse(raw) as T;
      mem.set(key, { v, exp: Date.now() + ttlSeconds * 1000 });
      return v;
    }
  } catch (err) {
    logger.warn('cache: redis read failed, computing fresh', { key, error: (err as Error).message });
  }

  // 3) compute + store
  const value = await produce();
  mem.set(key, { v: value, exp: Date.now() + ttlSeconds * 1000 });
  try {
    await getRedisClient().set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch { /* best-effort */ }
  return value;
}

/** Invalidate a key (call after writes that change cached data). */
export async function invalidate(key: string): Promise<void> {
  mem.delete(key);
  try { await getRedisClient().del(key); } catch { /* best-effort */ }
}

/**
 * Invalidate every key starting with `prefix` (e.g. 'tutors:search:').
 * Clears both the in-memory map and matching Redis keys (via non-blocking SCAN).
 */
export async function invalidatePrefix(prefix: string): Promise<void> {
  for (const k of mem.keys()) {
    if (k.startsWith(prefix)) mem.delete(k);
  }
  try {
    const redis = getRedisClient();
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100);
      cursor = next;
      if (keys.length) await redis.del(...keys);
    } while (cursor !== '0');
  } catch { /* best-effort */ }
}
