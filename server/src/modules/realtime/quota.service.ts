import { getRedisClient } from '../../config/redis';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';

/**
 * Tracks how much of the Pusher free plan we have spent and decides whether the
 * next client/broadcast goes to Pusher or falls back to our own Socket.IO server.
 *
 * Two independent ceilings, either of which trips the fallback:
 *   • concurrent connections (100)   — enforced by handing out fewer leases
 *   • messages per day (200,000)     — enforced by counting before publishing
 *
 * Counters live in Redis so they hold across restarts and are shared by every
 * API instance. Redis being unavailable must never take realtime down, so every
 * read fails **open** onto Socket.IO — the transport we control.
 */

const KEY_MESSAGES = (day: string) => `pusher:msgs:${day}`;
const KEY_CONNECTIONS = 'pusher:conns';
const KEY_BREAKER = 'pusher:breaker';

/** A connection lease is renewed by heartbeat; a tab that dies stops renewing. */
const LEASE_TTL_SECONDS = 90;
/** How long a Pusher API failure keeps everyone on Socket.IO. */
const BREAKER_COOLDOWN_SECONDS = 300;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Seconds until UTC midnight, so the daily counter expires when the quota resets. */
function secondsUntilMidnightUtc(): number {
  const now = new Date();
  const midnight = Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0,
  );
  return Math.max(60, Math.ceil((midnight - now.getTime()) / 1000));
}

export interface QuotaSnapshot {
  configured: boolean;
  breakerOpen: boolean;
  breakerReason: string | null;
  connections: number;
  maxConnections: number;
  messagesToday: number;
  maxDailyMessages: number;
  connectionsAvailable: boolean;
  messagesAvailable: boolean;
  /** What a new client would be told to use right now. */
  transport: 'pusher' | 'socket';
}

export class RealtimeQuotaService {
  /** Credentials present? Without them Pusher is simply not an option. */
  get isPusherConfigured(): boolean {
    return Boolean(env.PUSHER_APP_ID && env.PUSHER_KEY && env.PUSHER_SECRET);
  }

  private get messageCeiling(): number {
    return Math.floor(env.PUSHER_MAX_DAILY_MESSAGES * env.PUSHER_SAFETY_MARGIN);
  }

  private get connectionCeiling(): number {
    return Math.floor(env.PUSHER_MAX_CONNECTIONS * env.PUSHER_SAFETY_MARGIN);
  }

  /**
   * Opens the breaker for a cooldown. Called when Pusher rejects a publish —
   * a quota error we did not predict, an auth failure, or an outage.
   */
  async tripBreaker(reason: string): Promise<void> {
    try {
      await getRedisClient().set(KEY_BREAKER, reason, 'EX', BREAKER_COOLDOWN_SECONDS);
      logger.warn('Pusher breaker opened — falling back to Socket.IO', {
        reason,
        cooldownSeconds: BREAKER_COOLDOWN_SECONDS,
      });
    } catch {
      // If Redis is down we cannot record the trip; callers already fell back.
    }
  }

  async breakerReason(): Promise<string | null> {
    try {
      return await getRedisClient().get(KEY_BREAKER);
    } catch {
      return null;
    }
  }

  /**
   * Reserves budget for `count` messages. Returns false when the reservation
   * would cross the ceiling, in which case the caller must use Socket.IO.
   *
   * Increment-then-check rather than check-then-increment: two instances
   * publishing at once can each pass a check, but they cannot both win an
   * atomic INCR, so the counter never undercounts what we actually sent.
   */
  async reserveMessages(count: number): Promise<boolean> {
    if (count <= 0) return true;
    try {
      const redis = getRedisClient();
      const key = KEY_MESSAGES(today());
      const total = await redis.incrby(key, count);

      // First write of the day sets the expiry that lines up with the reset.
      if (total === count) await redis.expire(key, secondsUntilMidnightUtc());

      if (total > this.messageCeiling) {
        // Give the budget back so the counter reflects what was really sent.
        await redis.decrby(key, count);
        return false;
      }
      return true;
    } catch {
      return false; // Fail onto the transport we control.
    }
  }

  async messagesToday(): Promise<number> {
    try {
      const value = await getRedisClient().get(KEY_MESSAGES(today()));
      return value ? Number(value) : 0;
    } catch {
      return 0;
    }
  }

  async connectionCount(): Promise<number> {
    try {
      return await getRedisClient().zcard(KEY_CONNECTIONS);
    } catch {
      return 0;
    }
  }

  /**
   * Grants a client permission to hold a Pusher connection.
   *
   * Leases are a sorted set scored by expiry: stale entries are swept on every
   * call, so a browser that closes without telling us frees its slot within
   * `LEASE_TTL_SECONDS` instead of leaking a connection forever.
   */
  async acquireConnectionLease(leaseId: string): Promise<boolean> {
    try {
      const redis = getRedisClient();
      const now = Date.now();

      await redis.zremrangebyscore(KEY_CONNECTIONS, '-inf', now);

      // Renewing an existing lease must not consume a second slot.
      const existing = await redis.zscore(KEY_CONNECTIONS, leaseId);
      if (existing === null && (await redis.zcard(KEY_CONNECTIONS)) >= this.connectionCeiling) {
        return false;
      }

      await redis.zadd(KEY_CONNECTIONS, now + LEASE_TTL_SECONDS * 1000, leaseId);
      return true;
    } catch {
      return false;
    }
  }

  async releaseConnectionLease(leaseId: string): Promise<void> {
    try {
      await getRedisClient().zrem(KEY_CONNECTIONS, leaseId);
    } catch {
      // A lost release just means the lease expires on its own.
    }
  }

  /** Everything the admin console and the client handshake need, in one read. */
  async snapshot(): Promise<QuotaSnapshot> {
    const configured = this.isPusherConfigured;
    const [breakerReason, connections, messagesToday] = await Promise.all([
      this.breakerReason(),
      this.connectionCount(),
      this.messagesToday(),
    ]);

    const breakerOpen = breakerReason !== null;
    const connectionsAvailable = connections < this.connectionCeiling;
    const messagesAvailable = messagesToday < this.messageCeiling;

    return {
      configured,
      breakerOpen,
      breakerReason,
      connections,
      maxConnections: env.PUSHER_MAX_CONNECTIONS,
      messagesToday,
      maxDailyMessages: env.PUSHER_MAX_DAILY_MESSAGES,
      connectionsAvailable,
      messagesAvailable,
      transport:
        configured && !breakerOpen && connectionsAvailable && messagesAvailable
          ? 'pusher'
          : 'socket',
    };
  }

  /** Exposed for the leasing endpoint and tests. */
  get leaseTtlSeconds(): number {
    return LEASE_TTL_SECONDS;
  }
}

export const realtimeQuota = new RealtimeQuotaService();
