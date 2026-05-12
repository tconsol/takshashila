import { Queue, Worker } from 'bullmq';
import { redisConnection, defaultJobOptions } from './queue.config';
import { mediaService } from '../modules/media/media.service';
import { logger } from '../lib/logger';

export const cleanupQueue = new Queue('cleanup', {
  connection: redisConnection,
  defaultJobOptions,
});

export const cleanupWorker = new Worker(
  'cleanup',
  async (job) => {
    if (job.name === 'purge-orphan-media') {
      const count = await mediaService.purgeOrphanPendingFiles();
      logger.info('Orphan media purge complete', { purged: count });
    }
  },
  { connection: redisConnection, concurrency: 1 },
);

cleanupWorker.on('failed', (job, err) => {
  logger.error('Cleanup job failed', { jobId: job?.id, name: job?.name, error: err.message });
});

export async function scheduleCleanupJobs() {
  try {
    await cleanupQueue.add(
      'purge-orphan-media',
      {},
      { repeat: { every: 24 * 60 * 60 * 1000 }, jobId: 'daily-media-cleanup' },
    );
    logger.info('Cleanup job scheduler registered');
  } catch (err) {
    logger.warn('Cleanup job scheduler skipped (Redis unavailable)', { error: (err as Error).message });
  }
}
