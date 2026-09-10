import Pusher from 'pusher';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { realtimeQuota } from './quota.service';

/**
 * One broadcast API for the whole server. Callers say *who* and *what*; this
 * decides *how*.
 *
 *   realtime.emit(['user:abc', 'role:ADMIN'], 'data:invalidate', { module })
 *
 * Pusher carries it while the free plan has room; the moment either ceiling is
 * reached — or Pusher errors — the same payload goes out over our own Socket.IO
 * server instead. Clients listen for identical event names on both, so nothing
 * downstream knows or cares which transport delivered it.
 *
 * Live-class traffic (WebRTC signalling, whiteboard strokes) deliberately does
 * NOT come through here: it is bidirectional and high-frequency, and would
 * exhaust a 200k/day message budget in minutes. That stays on Socket.IO always.
 */

let pusher: Pusher | null = null;

function getPusher(): Pusher | null {
  if (!realtimeQuota.isPusherConfigured) return null;
  if (!pusher) {
    pusher = new Pusher({
      appId: env.PUSHER_APP_ID!,
      key: env.PUSHER_KEY!,
      secret: env.PUSHER_SECRET!,
      cluster: env.PUSHER_CLUSTER,
      useTLS: true,
    });
  }
  return pusher;
}

/**
 * Pusher channel names allow `[A-Za-z0-9_\-=@,.;]` — notably *not* the colon we
 * use in room names, so `user:abc` becomes `private-user-abc`. Private channels
 * force every subscriber through our auth endpoint, so one user cannot listen
 * on another's channel.
 */
export function roomToChannel(room: string): string {
  return `private-${room.replace(/[^A-Za-z0-9_\-=@,.]/g, '-')}`;
}

/** Pusher rejects more than 100 channels in a single trigger call. */
const MAX_CHANNELS_PER_TRIGGER = 100;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export type TransportUsed = 'pusher' | 'socket' | 'none';

export class RealtimeService {
  /**
   * Publishes `event` to every room. Returns which transport carried it, which
   * the admin console surfaces and tests assert on.
   */
  async emit(rooms: string[], event: string, payload: unknown = {}): Promise<TransportUsed> {
    const unique = [...new Set(rooms.filter(Boolean))];
    if (unique.length === 0) return 'none';

    if (await this.tryPusher(unique, event, payload)) return 'pusher';

    return this.viaSocket(unique, event, payload);
  }

  /** Convenience for the common single-room case. */
  async emitTo(room: string, event: string, payload: unknown = {}): Promise<TransportUsed> {
    return this.emit([room], event, payload);
  }

  private async tryPusher(rooms: string[], event: string, payload: unknown): Promise<boolean> {
    const client = getPusher();
    if (!client) return false;

    const snapshot = await realtimeQuota.snapshot();
    if (snapshot.breakerOpen || !snapshot.messagesAvailable) return false;

    // Pusher bills per channel per event, so a fan-out to N rooms costs N.
    if (!(await realtimeQuota.reserveMessages(rooms.length))) return false;

    try {
      const channels = rooms.map(roomToChannel);
      for (const batch of chunk(channels, MAX_CHANNELS_PER_TRIGGER)) {
        await client.trigger(batch, event, payload);
      }
      return true;
    } catch (error) {
      // Any publish failure opens the breaker so the next call skips straight
      // to Socket.IO rather than paying the round-trip to fail again.
      await realtimeQuota.tripBreaker((error as Error).message.slice(0, 200));
      return false;
    }
  }

  private viaSocket(rooms: string[], event: string, payload: unknown): TransportUsed {
    try {
      // Imported lazily: the socket server is created after this module loads.
      const { getIO } = require('../../sockets/socket.handler') as typeof import('../../sockets/socket.handler');
      const io = getIO();
      rooms.forEach((room) => io.to(room).emit(event, payload));
      return 'socket';
    } catch {
      logger.warn('Realtime broadcast dropped — no transport available', { event });
      return 'none';
    }
  }

  /**
   * Authorises a browser to subscribe to a private channel. A user may only
   * ever join their own `user:` channel or a channel for a role they hold —
   * without this check any signed-in user could read another's notifications.
   */
  authorizeChannel(
    socketId: string,
    channel: string,
    user: { publicId: string; role: string },
  ): { auth: string } | null {
    const client = getPusher();
    if (!client) return null;

    const allowed = [
      roomToChannel(`user:${user.publicId}`),
      roomToChannel(`role:${user.role}`),
    ];
    if (!allowed.includes(channel)) return null;

    return client.authorizeChannel(socketId, channel);
  }

  /** Channels the browser should subscribe to for this user. */
  channelsFor(user: { publicId: string; role: string }): string[] {
    return [roomToChannel(`user:${user.publicId}`), roomToChannel(`role:${user.role}`)];
  }
}

export const realtime = new RealtimeService();
