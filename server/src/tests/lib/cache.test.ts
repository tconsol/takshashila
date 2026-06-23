/* Cache helper tests — verify read-through, TTL expiry and invalidation
   work via the in-memory fallback (Redis mocked to throw so the fallback path
   is exercised deterministically without a live Redis). */
jest.mock('../../config/redis', () => ({
  getRedisClient: () => { throw new Error('no redis in test'); },
}));

import { cached, invalidate } from '../../lib/cache';

describe('cached()', () => {
  it('computes once then serves from cache (no second produce call)', async () => {
    const produce = jest.fn().mockResolvedValue({ n: 1 });
    const a = await cached('k1', 60, produce);
    const b = await cached('k1', 60, produce);
    expect(a).toEqual({ n: 1 });
    expect(b).toEqual({ n: 1 });
    expect(produce).toHaveBeenCalledTimes(1); // cache hit on 2nd call
  });

  it('recomputes after TTL expiry', async () => {
    const produce = jest.fn()
      .mockResolvedValueOnce('first')
      .mockResolvedValueOnce('second');
    const v1 = await cached('k2', 0, produce); // ttl 0 → immediately stale
    await new Promise((r) => setTimeout(r, 5));
    const v2 = await cached('k2', 0, produce);
    expect(v1).toBe('first');
    expect(v2).toBe('second');
    expect(produce).toHaveBeenCalledTimes(2);
  });

  it('invalidate() forces a recompute', async () => {
    const produce = jest.fn()
      .mockResolvedValueOnce('a')
      .mockResolvedValueOnce('b');
    await cached('k3', 60, produce);
    await invalidate('k3');
    const v = await cached('k3', 60, produce);
    expect(v).toBe('b');
    expect(produce).toHaveBeenCalledTimes(2);
  });

  it('distinct keys cache independently', async () => {
    const v1 = await cached('user:1', 60, async () => 'one');
    const v2 = await cached('user:2', 60, async () => 'two');
    expect(v1).toBe('one');
    expect(v2).toBe('two');
  });
});
