import { Queue, Worker } from 'bullmq';
import { redisConnection, defaultJobOptions } from './queue.config';
import { mediaService } from '../modules/media/media.service';
import { logger } from '../lib/logger';

export const cleanupQueue = new Queue('cleanup', {
  connection: redisConnection,
  defaultJobOptions,
});

// Worker created only in the dedicated worker process (worker.ts).
export function startCleanupWorker(): Worker {
  const worker = new Worker(
    'cleanup',
    async (job) => {
      if (job.name === 'purge-orphan-media') {
        const count = await mediaService.purgeOrphanPendingFiles();
        logger.info('Orphan media purge complete', { purged: count });
      }

      if (job.name === 'auto-resolve-classes') {
        const { classService } = await import('../modules/classes/class.service');
        const { completed, cancelled } = await classService.autoResolveOverdueClasses();
        if (completed || cancelled) {
          logger.info('Auto-resolved overdue classes', { completed, cancelled });
        }
      }
    },
    { connection: redisConnection, concurrency: 1 },
  );
  worker.on('failed', (job, err) => {
    logger.error('Cleanup job failed', { jobId: job?.id, name: job?.name, error: err.message });
  });
  return worker;
}

export async function scheduleCleanupJobs() {
  try {
    await cleanupQueue.add(
      'purge-orphan-media',
      {},
      { repeat: { every: 24 * 60 * 60 * 1000 }, jobId: 'daily-media-cleanup' },
    );
    // Every two minutes: a class is at most that far past its grace period
    // before it is closed, which is tight enough that nobody notices.
    await cleanupQueue.add(
      'auto-resolve-classes',
      {},
      { repeat: { every: 2 * 60 * 1000 }, jobId: 'auto-resolve-classes' },
    );

    logger.info('Cleanup job scheduler registered');
  } catch (err) {
    logger.warn('Cleanup job scheduler skipped (Redis unavailable)', { error: (err as Error).message });
  }
}
