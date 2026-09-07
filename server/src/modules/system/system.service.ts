import mongoose from 'mongoose';
import os from 'os';
import type { Queue } from 'bullmq';
import { getRedisClient } from '../../config/redis';
import { emailQueue } from '../../queues/email.queue';
import { notificationQueue } from '../../queues/notification.queue';
import { cleanupQueue } from '../../queues/cleanup.queue';
import { getRequestMetrics } from '../../middlewares/metrics.middleware';
import { getIO } from '../../sockets/socket.handler';

export type HealthStatus = 'ok' | 'degraded' | 'down';

export interface ComponentHealth {
  name: string;
  status: HealthStatus;
  latencyMs: number | null;
  detail?: string;
}

export interface QueueHealth {
  name: string;
  status: HealthStatus;
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  completed: number;
  detail?: string;
}

const MONGO_STATES: Record<number, string> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

/** A queue with jobs stuck in `failed` is degraded, not down — the app still serves. */
const FAILED_JOB_DEGRADED_THRESHOLD = 1;

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T | null; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const value = await fn();
    return { value, latencyMs: Date.now() - start };
  } catch (e) {
    return { value: null, latencyMs: Date.now() - start, error: (e as Error).message };
  }
}

export class SystemService {
  private async checkMongo(): Promise<ComponentHealth> {
    const state = mongoose.connection.readyState;
    if (state !== 1) {
      return {
        name: 'mongodb',
        status: state === 2 ? 'degraded' : 'down',
        latencyMs: null,
        detail: MONGO_STATES[state] ?? `state ${state}`,
      };
    }

    const { latencyMs, error } = await timed(() => mongoose.connection.db!.admin().ping());
    return {
      name: 'mongodb',
      status: error ? 'down' : 'ok',
      latencyMs: error ? null : latencyMs,
      detail: error ?? `${mongoose.connection.name} @ ${mongoose.connection.host}`,
    };
  }

  private async checkRedis(): Promise<ComponentHealth> {
    const { latencyMs, error } = await timed(() => getRedisClient().ping());
    return {
      name: 'redis',
      status: error ? 'down' : 'ok',
      latencyMs: error ? null : latencyMs,
      detail: error,
    };
  }

  private async checkQueue(queue: Queue, name: string): Promise<QueueHealth> {
    try {
      const counts = await queue.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed');
      const failed = counts.failed ?? 0;
      return {
        name,
        status: failed >= FAILED_JOB_DEGRADED_THRESHOLD ? 'degraded' : 'ok',
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        delayed: counts.delayed ?? 0,
        failed,
        completed: counts.completed ?? 0,
      };
    } catch (e) {
      // Queue counts live in Redis — an unreachable Redis surfaces here too.
      return {
        name, status: 'down',
        waiting: 0, active: 0, delayed: 0, failed: 0, completed: 0,
        detail: (e as Error).message,
      };
    }
  }

  /** Live socket count. Returns nulls rather than throwing before the server boots. */
  private getSocketStats(): { connectedSockets: number | null; rooms: number | null } {
    try {
      const io = getIO();
      return {
        connectedSockets: io.sockets.sockets.size,
        rooms: io.sockets.adapter.rooms.size,
      };
    } catch {
      return { connectedSockets: null, rooms: null };
    }
  }

  /**
   * Repeatable jobs registered on each queue, with when they last ran. This is
   * what answers "did the nightly cleanup actually fire last night".
   */
  private async getScheduledJobs() {
    const queues: { queue: Queue; name: string }[] = [
      { queue: cleanupQueue, name: 'cleanup' },
      { queue: emailQueue, name: 'email' },
      { queue: notificationQueue, name: 'notification' },
    ];

    const results = await Promise.all(
      queues.map(async ({ queue, name }) => {
        try {
          const repeatables = await queue.getRepeatableJobs();
          return repeatables.map((job) => ({
            queue: name,
            name: job.name,
            pattern: job.pattern ?? null,
            nextRunAt: job.next ? new Date(job.next).toISOString() : null,
          }));
        } catch {
          return [];
        }
      }),
    );

    return results.flat();
  }

  async getHealth() {
    const [mongo, redis, email, notification, cleanup] = await Promise.all([
      this.checkMongo(),
      this.checkRedis(),
      this.checkQueue(emailQueue, 'email'),
      this.checkQueue(notificationQueue, 'notification'),
      this.checkQueue(cleanupQueue, 'cleanup'),
    ]);

    const components: ComponentHealth[] = [mongo, redis];
    const queues: QueueHealth[] = [email, notification, cleanup];

    const allStatuses = [...components, ...queues].map((c) => c.status);
    const overall: HealthStatus = allStatuses.includes('down')
      ? 'down'
      : allStatuses.includes('degraded') ? 'degraded' : 'ok';

    const mem = process.memoryUsage();

    return {
      status: overall,
      checkedAt: new Date().toISOString(),
      components,
      queues,
      requests: getRequestMetrics(),
      realtime: this.getSocketStats(),
      scheduledJobs: await this.getScheduledJobs(),
      process: {
        uptimeSeconds: Math.floor(process.uptime()),
        nodeVersion: process.version,
        pid: process.pid,
        env: process.env.NODE_ENV ?? 'development',
        memory: {
          rssBytes: mem.rss,
          heapUsedBytes: mem.heapUsed,
          heapTotalBytes: mem.heapTotal,
        },
      },
      host: {
        platform: process.platform,
        cpuCount: os.cpus().length,
        loadAverage: os.loadavg(),
        totalMemoryBytes: os.totalmem(),
        freeMemoryBytes: os.freemem(),
      },
    };
  }
}

export const systemService = new SystemService();
