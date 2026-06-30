import { createServer } from 'http';
import app from './app';
import { env } from './config/env';
import { connectDatabase } from './config/database';
import { getRedisClient, verifyRedisConnection } from './config/redis';
import { logger } from './lib/logger';
import { initSocketServer } from './sockets/socket.handler';
import { auditService } from './modules/audit/audit.service';
import { notificationService } from './modules/notifications/notification.service';
import { verifySmtpConnection } from './lib/email-verifier';
import { isFirebaseConfigured } from './lib/firebase-admin';

// Background workers (email/notification/cleanup/slot-expiry) live in a separate
// process by default (see worker.ts) so the web service can scale to zero on
// Cloud Run no always-on instance = no idle bill. Set RUN_WORKERS=true to also
// run them inside the web process (single-instance / local dev convenience).
const RUN_WORKERS = process.env.RUN_WORKERS === 'true';

async function bootstrap() {
  // Verify Redis first so its status is visible in the terminal even if Mongo fails.
  await verifyRedisConnection();
  await connectDatabase();
  getRedisClient();

  void auditService;
  notificationService.setupEventListeners();
  verifySmtpConnection();
  logger.info(`Firebase Admin: ${isFirebaseConfigured() ? 'configured' : 'not configured (FCM push disabled)'}`);

  // Stripe webhook crediting is only trustworthy when the signing secret is set
  // (handler rejects unsigned/forged events). Warn loudly if it's missing in prod.
  if (env.NODE_ENV === 'production' && !env.STRIPE_WEBHOOK_SECRET) {
    logger.warn('STRIPE_WEBHOOK_SECRET is not set Stripe webhook events will be REJECTED. Set it before accepting card payments.');
  }

  const httpServer = createServer(app);
  initSocketServer(httpServer);

  if (RUN_WORKERS) {
    const { startEmailWorker } = await import('./queues/email.queue');
    const { startCleanupWorker, scheduleCleanupJobs } = await import('./queues/cleanup.queue');
    const { startNotificationWorker } = await import('./queues/notification.queue');
    const { startSlotExpiryJob } = await import('./jobs/slot-expiry.job');
    startEmailWorker();
    startNotificationWorker();
    startCleanupWorker();
    await scheduleCleanupJobs();
    startSlotExpiryJob();
    logger.info('Background workers running inside web process (RUN_WORKERS=true)');
  }

  httpServer.listen(env.PORT, () => {
    logger.info(`brainbaseeduAPI running on port ${env.PORT} [${env.NODE_ENV}]`);
    logger.info(`API base: /api/${env.API_VERSION}`);
  });

  const gracefulShutdown = async (signal: string) => {
    logger.info(`${signal} received shutting down gracefully`);
    httpServer.close(async () => {
      const { disconnectDatabase } = await import('./config/database');
      const { disconnectRedis } = await import('./config/redis');
      await disconnectDatabase();
      await disconnectRedis();
      logger.info('Server shut down');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', { error: err });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { reason });
    process.exit(1);
  });
}

bootstrap().catch((err) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
