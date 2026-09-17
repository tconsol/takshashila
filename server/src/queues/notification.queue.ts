import { Queue, Worker } from 'bullmq';
import { redisConnection, defaultJobOptions } from './queue.config';
import { notificationService } from '../modules/notifications/notification.service';
import type { CreateNotificationDto } from '../modules/notifications/notification.types';
import { logger } from '../lib/logger';

export const notificationQueue = new Queue<CreateNotificationDto>('notification', {
  connection: redisConnection,
  defaultJobOptions,
});

// Worker created only in the dedicated worker process (worker.ts).
export function startNotificationWorker(): Worker<CreateNotificationDto> {
  const worker = new Worker<CreateNotificationDto>(
    'notification',
    async (job) => {
      await notificationService.create(job.data);
      logger.info('Notification created from queue', { type: job.data.type, recipient: job.data.recipientPublicId });
    },
    { connection: redisConnection, concurrency: 10 },
  );
  worker.on('failed', (job, err) => {
    logger.error('Notification job failed', { jobId: job?.id, error: err.message });
  });
  return worker;
}

export function enqueueNotification(data: CreateNotificationDto) {
  return notificationQueue.add('create', data);
}
