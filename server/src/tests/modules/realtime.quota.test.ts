/**
 * The fallback decision is the whole point of this module: get it wrong and we
 * either blow the Pusher free plan or never use it. These cover the boundaries.
 */

// An in-memory stand-in for the Redis commands the quota service uses.
const store = new Map<string, string>();
const zsets = new Map<string, Map<string, number>>();

const redisMock = {
  get: jest.fn(async (k: string) => store.get(k) ?? null),
  set: jest.fn(async (k: string, v: string) => { store.set(k, v); return 'OK'; }),
  incrby: jest.fn(async (k: string, by: number) => {
    const next = Number(store.get(k) ?? 0) + by;
    store.set(k, String(next));
    return next;
  }),
  decrby: jest.fn(async (k: string, by: number) => {
    const next = Number(store.get(k) ?? 0) - by;
    store.set(k, String(next));
    return next;
  }),
  expire: jest.fn(async () => 1),
  zcard: jest.fn(async (k: string) => (zsets.get(k)?.size ?? 0)),
  zscore: jest.fn(async (k: string, m: string) => {
    const v = zsets.get(k)?.get(m);
    return v === undefined ? null : String(v);
  }),
  zadd: jest.fn(async (k: string, score: number, m: string) => {
    if (!zsets.has(k)) zsets.set(k, new Map());
    zsets.get(k)!.set(m, score);
    return 1;
  }),
  zrem: jest.fn(async (k: string, m: string) => { zsets.get(k)?.delete(m); return 1; }),
  zremrangebyscore: jest.fn(async (k: string, _min: string, max: number) => {
    const set = zsets.get(k);
    if (!set) return 0;
    let removed = 0;
    for (const [member, score] of set) {
      if (score <= max) { set.delete(member); removed += 1; }
    }
    return removed;
  }),
};

jest.mock('../../config/redis', () => ({ getRedisClient: () => redisMock }));

process.env.PUSHER_APP_ID = 'test-app';
process.env.PUSHER_KEY = 'test-key';
process.env.PUSHER_SECRET = 'test-secret';
process.env.PUSHER_MAX_CONNECTIONS = '100';
process.env.PUSHER_MAX_DAILY_MESSAGES = '1000';
process.env.PUSHER_SAFETY_MARGIN = '0.95';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { realtimeQuota } = require('../../modules/realtime/quota.service');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { roomToChannel } = require('../../modules/realtime/realtime.service');

beforeEach(() => {
  store.clear();
  zsets.clear();
});

describe('roomToChannel', () => {
  it('strips the colon Pusher does not allow in channel names', () => {
    expect(roomToChannel('user:abc-123')).toBe('private-user-abc-123');
    expect(roomToChannel('role:SUPER_ADMIN')).toBe('private-role-SUPER_ADMIN');
  });

  it('always produces a private channel so subscription goes through auth', () => {
    expect(roomToChannel('anything')).toMatch(/^private-/);
  });
});

describe('message quota', () => {
  it('allows publishing below the safety ceiling', async () => {
    // ceiling = 1000 * 0.95 = 950
    await expect(realtimeQuota.reserveMessages(949)).resolves.toBe(true);
    await expect(realtimeQuota.messagesToday()).resolves.toBe(949);
  });

  it('refuses the reservation that would cross the ceiling', async () => {
    await realtimeQuota.reserveMessages(950);
    await expect(realtimeQuota.reserveMessages(1)).resolves.toBe(false);
  });

  it('does not consume budget for a refused reservation', async () => {
    await realtimeQuota.reserveMessages(950);
    await realtimeQuota.reserveMessages(500);
    // The rejected 500 was given back, so the counter still reads 950.
    await expect(realtimeQuota.messagesToday()).resolves.toBe(950);
  });

  it('trips the fallback before the real 200k limit, not on it', async () => {
    await realtimeQuota.reserveMessages(950);
    const snapshot = await realtimeQuota.snapshot();
    expect(snapshot.messagesAvailable).toBe(false);
    expect(snapshot.transport).toBe('socket');
    // Real quota is untouched — we stopped 50 messages early on purpose.
    expect(snapshot.messagesToday).toBeLessThan(snapshot.maxDailyMessages);
  });
});

describe('connection leases', () => {
  it('grants leases up to the safety ceiling', async () => {
    for (let i = 0; i < 95; i++) {
      await expect(realtimeQuota.acquireConnectionLease(`u${i}`)).resolves.toBe(true);
    }
    await expect(realtimeQuota.acquireConnectionLease('u96')).resolves.toBe(false);
  });

  it('renewing an existing lease does not consume a second slot', async () => {
    for (let i = 0; i < 95; i++) await realtimeQuota.acquireConnectionLease(`u${i}`);
    // At capacity, but u0 already holds one — its renewal must still succeed.
    await expect(realtimeQuota.acquireConnectionLease('u0')).resolves.toBe(true);
    await expect(realtimeQuota.connectionCount()).resolves.toBe(95);
  });

  it('frees the slot on release', async () => {
    for (let i = 0; i < 95; i++) await realtimeQuota.acquireConnectionLease(`u${i}`);
    await realtimeQuota.releaseConnectionLease('u0');
    await expect(realtimeQuota.acquireConnectionLease('newcomer')).resolves.toBe(true);
  });

  it('reclaims slots from tabs that stopped renewing', async () => {
    zsets.set('pusher:conns', new Map([['stale', Date.now() - 1000]]));
    // The sweep runs on acquire, so the expired lease is not counted.
    await expect(realtimeQuota.acquireConnectionLease('fresh')).resolves.toBe(true);
    await expect(realtimeQuota.connectionCount()).resolves.toBe(1);
  });
});

describe('breaker', () => {
  it('forces Socket.IO while open', async () => {
    await realtimeQuota.tripBreaker('rate limited');
    const snapshot = await realtimeQuota.snapshot();
    expect(snapshot.breakerOpen).toBe(true);
    expect(snapshot.breakerReason).toBe('rate limited');
    expect(snapshot.transport).toBe('socket');
  });

  it('reports pusher when nothing is wrong', async () => {
    const snapshot = await realtimeQuota.snapshot();
    expect(snapshot.transport).toBe('pusher');
    expect(snapshot.configured).toBe(true);
  });
});
