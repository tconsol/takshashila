import mongoose from 'mongoose';
import os from 'os';
import type { Queue } from 'bullmq';
import { getRedisClient } from '../../config/redis';
import { emailQueue } from '../../queues/email.queue';
import { notificationQueue } from '../../queues/notification.queue';
import { cleanupQueue } from '../../queues/cleanup.queue';
import { getRequestMetrics } from '../../middlewares/metrics.middleware';
import { getIO } from '../../sockets/socket.handler';
import { integrationsService } from './integrations.service';
import { NotFoundError } from '../../utils/error';

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

/**
 * A one-line identifier for a job, deliberately excluding its payload.
 * Email jobs carry addresses and rendered message bodies; a console showing
 * failures must not become a place to read users' mail.
 */
function summariseJobData(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const record = data as Record<string, unknown>;

  if (typeof record.to === 'string') {
    const subject = typeof record.subject === 'string' ? record.subject : 'email';
    return `${subject} → ${record.to}`;
  }
  if (typeof record.recipientPublicId === 'string') {
    return `notification → ${record.recipientPublicId}`;
  }
  return Object.keys(record).slice(0, 4).join(', ');
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

  private queueByName(name: string): Queue | null {
    const queues: Record<string, Queue> = {
      email: emailQueue,
      notification: notificationQueue,
      cleanup: cleanupQueue,
    };
    return queues[name] ?? null;
  }

  /**
   * The failed jobs themselves, not just a count. A number tells you something
   * broke; the reason and stack tell you what, and which recipient lost an email.
   */
  async getFailedJobs(queueName: string, limit = 20) {
    const queue = this.queueByName(queueName);
    if (!queue) throw new NotFoundError(`Queue "${queueName}"`);

    const jobs = await queue.getFailed(0, Math.max(1, Math.min(limit, 100)) - 1);

    return jobs.map((job) => ({
      id: String(job.id),
      name: job.name,
      queue: queueName,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason ?? null,
      // The first frame is where it actually broke; the rest is framework noise.
      stackHead: job.stacktrace?.[0]?.split('\n').slice(0, 3).join('\n') ?? null,
      failedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
      // Payloads can carry addresses and message bodies — send only enough to
      // identify the job, never the content itself.
      summary: summariseJobData(job.data),
    }));
  }

  /** Re-queues a failed job. Used after the underlying cause is fixed. */
  async retryFailedJob(queueName: string, jobId: string): Promise<void> {
    const queue = this.queueByName(queueName);
    if (!queue) throw new NotFoundError(`Queue "${queueName}"`);

    const job = await queue.getJob(jobId);
    if (!job) throw new NotFoundError('Job');
    await job.retry();
  }

  /** Clears the failed set once the jobs are known to be unrecoverable. */
  async clearFailedJobs(queueName: string): Promise<number> {
    const queue = this.queueByName(queueName);
    if (!queue) throw new NotFoundError(`Queue "${queueName}"`);

    const removed = await queue.clean(0, 1000, 'failed');
    return removed.length;
  }

  async getHealth() {
    const [mongo, redis, email, notification, cleanup, integrations] = await Promise.all([
      this.checkMongo(),
      this.checkRedis(),
      this.checkQueue(emailQueue, 'email'),
      this.checkQueue(notificationQueue, 'notification'),
      this.checkQueue(cleanupQueue, 'cleanup'),
      integrationsService.getAll(),
    ]);

    const components: ComponentHealth[] = [mongo, redis];
    const queues: QueueHealth[] = [email, notification, cleanup];

    const allStatuses: HealthStatus[] = [
      ...components.map((c) => c.status),
      ...queues.map((q) => q.status),
      // `not-configured` is a deliberate choice, not a fault — exclude it.
      ...integrations
        .filter((i) => i.status !== 'not-configured')
        .map((i): HealthStatus => (i.status === 'down' ? 'down' : i.status === 'degraded' ? 'degraded' : 'ok')),
    ];
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
      integrations,
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
