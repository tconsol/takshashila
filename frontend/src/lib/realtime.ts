import Pusher, { type Channel } from 'pusher-js';
import { api } from './axios';

/**
 * Realtime transport manager.
 *
 * Broadcast traffic (data:invalidate, notification:new, worksheet:*, schedule
 * alerts) is delivered over **Pusher** while the free plan has room, and over
 * our own **Socket.IO** server once either ceiling is reached. The server
 * decides which at handshake time and this module just does as it is told.
 *
 * Socket.IO stays connected regardless — chat, WebRTC signalling and whiteboard
 * sync are bidirectional and high-frequency, so they never go through Pusher.
 * Subscribers here therefore receive broadcast events from whichever transport
 * is live, without knowing which one that is.
 */

export type Transport = 'pusher' | 'socket';

interface RealtimeConfig {
  transport: Transport;
  leaseId: string;
  heartbeatSeconds: number;
  pusher: {
    key: string;
    cluster: string;
    authEndpoint: string;
    channels: string[];
  } | null;
  reason: string | null;
}

type Handler = (payload: unknown) => void;

/** One id per tab so two tabs never share a connection lease. */
const TAB_ID = Math.random().toString(36).slice(2, 10);

/** Long enough to cover a multi-channel fan-out, short enough that a genuine
 *  repeat of the same event still gets through. */
const DEDUPE_WINDOW_MS = 1500;

class RealtimeManager {
  private pusher: Pusher | null = null;
  private channels: Channel[] = [];
  private handlers = new Map<string, Set<Handler>>();
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private started = false;

  transport: Transport = 'socket';
  reason: string | null = null;

  /**
   * Asks the server which transport to use and connects it. Safe to call more
   * than once; only the first call does work until `stop()` runs.
   */
  async start(token: string): Promise<Transport> {
    if (this.started) return this.transport;
    this.started = true;

    let config: RealtimeConfig;
    try {
      const res = await api.get(`/realtime/config?tabId=${TAB_ID}`);
      config = res.data.data as RealtimeConfig;
    } catch {
      // Handshake unreachable → Socket.IO, which is already connecting anyway.
      this.transport = 'socket';
      this.reason = 'handshake-failed';
      return this.transport;
    }

    this.transport = config.transport;
    this.reason = config.reason;

    if (config.transport === 'pusher' && config.pusher) {
      this.connectPusher(config.pusher, token);
      this.startHeartbeat(config.heartbeatSeconds);
    }

    return this.transport;
  }

  private connectPusher(cfg: NonNullable<RealtimeConfig['pusher']>, token: string): void {
    this.pusher = new Pusher(cfg.key, {
      cluster: cfg.cluster,
      // Private channels are signed by our API, so a user can only ever
      // subscribe to their own channels.
      channelAuthorization: {
        endpoint: cfg.authEndpoint,
        transport: 'ajax',
        headers: { Authorization: `Bearer ${token}` },
      },
    });

    this.channels = cfg.channels.map((name) => {
      const channel = this.pusher!.subscribe(name);
      // Re-dispatch every already-registered event onto the new channel.
      this.handlers.forEach((_set, event) => {
        channel.bind(event, (payload: unknown) => this.dispatch(event, payload));
      });
      return channel;
    });
  }

  /**
   * Renews the connection lease. Without this the server reclaims the slot
   * after its TTL and hands it to another client.
   */
  private startHeartbeat(seconds: number): void {
    this.stopHeartbeat();
    this.heartbeat = setInterval(() => {
      api.post('/realtime/heartbeat', { tabId: TAB_ID }).catch(() => {});
    }, Math.max(15, seconds) * 1000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
  }

  /**
   * Subscribes to a broadcast event. Returns an unsubscribe function.
   * When Socket.IO is the active transport this is a no-op — `useSocket`
   * handles those listeners — so callers can register unconditionally.
   */
  on(event: string, handler: Handler): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
      // Bind lazily on channels that already exist.
      this.channels.forEach((channel) => {
        channel.bind(event, (payload: unknown) => this.dispatch(event, payload));
      });
    }
    set.add(handler);

    return () => {
      set!.delete(handler);
    };
  }

  /**
   * A server emit addresses several rooms at once (`user:abc` + `role:ADMIN`).
   * Socket.IO collapses that to one delivery per socket; Pusher does not — it
   * triggers each channel independently, so a client subscribed to both receives
   * the same payload twice and fires two toasts. Drop a repeat of the same
   * event+payload inside a short window.
   */
  private recentlyDispatched = new Map<string, number>();

  private isDuplicate(event: string, payload: unknown): boolean {
    let key: string;
    try {
      key = `${event}:${JSON.stringify(payload)}`;
    } catch {
      return false; // Unserialisable payload — let it through rather than guess.
    }

    const now = Date.now();
    const last = this.recentlyDispatched.get(key);
    if (last !== undefined && now - last < DEDUPE_WINDOW_MS) return true;

    this.recentlyDispatched.set(key, now);
    if (this.recentlyDispatched.size > 200) {
      for (const [k, at] of this.recentlyDispatched) {
        if (now - at >= DEDUPE_WINDOW_MS) this.recentlyDispatched.delete(k);
      }
    }
    return false;
  }

  private dispatch(event: string, payload: unknown): void {
    if (this.isDuplicate(event, payload)) return;
    this.handlers.get(event)?.forEach((handler) => {
      try {
        handler(payload);
      } catch {
        // A throwing subscriber must not stop the others.
      }
    });
  }

  /** Releases the lease immediately so the slot is reusable on tab close. */
  async stop(): Promise<void> {
    this.stopHeartbeat();

    this.channels.forEach((channel) => this.pusher?.unsubscribe(channel.name));
    this.channels = [];
    this.pusher?.disconnect();
    this.pusher = null;
    this.handlers.clear();
    this.started = false;

    // keepalive so the release survives the page going away.
    try {
      await api.post('/realtime/release', { tabId: TAB_ID });
    } catch {
      // The lease expires on its own if this never lands.
    }
  }
}

export const realtime = new RealtimeManager();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    void realtime.stop();
  });
}
