import { createServer } from 'http';
import app from './app';
import { env } from './config/env';
import { connectDatabase } from './config/database';
import { getRedisClient } from './config/redis';
import { logger } from './lib/logger';
import { initSocketServer } from './sockets/socket.handler';
import { scheduleCleanupJobs } from './queues/cleanup.queue';
import { auditService } from './modules/audit/audit.service';
import { notificationService } from './modules/notifications/notification.service';
import { startSlotExpiryJob } from './jobs/slot-expiry.job';

async function bootstrap() {
  await connectDatabase();
  getRedisClient();

  void auditService;
  notificationService.setupEventListeners();

  const httpServer = createServer(app);
  initSocketServer(httpServer);

  await scheduleCleanupJobs();
  startSlotExpiryJob();

  httpServer.listen(env.PORT, () => {
    logger.info(`Takshashila API running on port ${env.PORT} [${env.NODE_ENV}]`);
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
