import { Queue, Worker } from 'bullmq';
import { redisConnection, defaultJobOptions } from './queue.config';
import { notificationService } from '../modules/notifications/notification.service';
import type { CreateNotificationDto } from '../modules/notifications/notification.types';
import { logger } from '../lib/logger';

export const notificationQueue = new Queue<CreateNotificationDto>('notification', {
  connection: redisConnection,
  defaultJobOptions,
});

export const notificationWorker = new Worker<CreateNotificationDto>(
  'notification',
  async (job) => {
    await notificationService.create(job.data);
    logger.info('Notification queued+created', { type: job.data.type, recipient: job.data.recipientPublicId });
  },
  { connection: redisConnection, concurrency: 10 },
);

notificationWorker.on('failed', (job, err) => {
  logger.error('Notification job failed', { jobId: job?.id, error: err.message });
});

export function enqueueNotification(data: CreateNotificationDto) {
  return notificationQueue.add('create', data);
}
