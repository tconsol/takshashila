/* Dedicated background-worker process.
   Runs the BullMQ workers (email, notification, cleanup) + scheduled jobs
   (slot-expiry, daily media cleanup). Keeping these OUT of the web process lets
   the web service scale to zero on Cloud Run (no idle instance = no idle bill).

   Run: `npm run worker` (prod: `node dist/worker.js`).
   Deploy: one small always-on instance, OR trigger periodically — see notes. */
import { connectDatabase, disconnectDatabase } from './config/database';
import { getRedisClient, disconnectRedis } from './config/redis';
import { env } from './config/env';
import { logger } from './lib/logger';
import { startEmailWorker } from './queues/email.queue';
import { startCleanupWorker, scheduleCleanupJobs } from './queues/cleanup.queue';
import { startNotificationWorker } from './queues/notification.queue';
import { startSlotExpiryJob } from './jobs/slot-expiry.job';
import type { Worker } from 'bullmq';

async function bootstrap() {
  await connectDatabase();
  getRedisClient();

  const workers: Worker[] = [
    startEmailWorker(),
    startNotificationWorker(),
    startCleanupWorker(),
  ];

  await scheduleCleanupJobs();
  startSlotExpiryJob();

  logger.info(`Worker process started [${env.NODE_ENV}] — email · notification · cleanup · slot-expiry`);

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down worker`);
    try {
      await Promise.all(workers.map((w) => w.close()));
      await disconnectDatabase();
      await disconnectRedis();
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('uncaughtException', (err) => { logger.error('Worker uncaught exception', { error: err }); process.exit(1); });
  process.on('unhandledRejection', (reason) => { logger.error('Worker unhandled rejection', { reason }); process.exit(1); });
}

bootstrap().catch((err) => {
  console.error('Worker bootstrap failed:', err);
  process.exit(1);
});
