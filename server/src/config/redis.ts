import Redis from 'ioredis';
import { env } from './env';
import { logger } from '../lib/logger';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 10) {
          logger.error('Redis max retries reached');
          return null;
        }
        return Math.min(times * 200, 3000);
      },
      enableReadyCheck: true,
      lazyConnect: true,   // connect on first use, not on boot
    });

    redisClient.on('connect', () => logger.info('Redis connected'));
    redisClient.on('error', (err) => logger.error('Redis error', { error: err.message }));
    redisClient.on('reconnecting', () => logger.warn('Redis reconnecting'));
  }

  return redisClient;
}

/** Eagerly verify Redis connectivity and log a clear result. Non-fatal. */
export async function verifyRedisConnection(): Promise<boolean> {
  try {
    const pong = await getRedisClient().ping();
    logger.info(`Redis connected (${pong}) → ${env.REDIS_HOST}:${env.REDIS_PORT}`);
    return true;
  } catch (err) {
    logger.error('Redis connection FAILED', { error: (err as Error).message });
    return false;
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis disconnected');
  }
}
