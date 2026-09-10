import { Queue, Worker } from 'bullmq';
import nodemailer from 'nodemailer';
import { redisConnection, defaultJobOptions } from './queue.config';
import { logger } from '../lib/logger';
import { env } from '../config/env';

export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export const emailQueue = new Queue<EmailJobData>('email', {
  connection: redisConnection,
  defaultJobOptions,
});

/** Exported so the system console can probe SMTP with the real transport. */
export const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

/**
 * Send an email RIGHT NOW via SMTP (no queue, no worker needed).
 * Use for critical, user-blocking transactional mail (email verification,
 * password reset, invites) so delivery never depends on a worker process running.
 */
export async function sendEmailNow(data: EmailJobData): Promise<void> {
  const { to, subject, html, text } = data;
  await transporter.sendMail({ from: env.EMAIL_FROM, to, subject, html, text });
  logger.info('Email sent (direct)', { to, subject });
}

// Worker is created ONLY in the dedicated worker process (see worker.ts), so the
// web process never spins up a long-running poller → it can scale to zero.
export function startEmailWorker(): Worker<EmailJobData> {
  const worker = new Worker<EmailJobData>(
    'email',
    async (job) => {
      await sendEmailNow(job.data);
    },
    { connection: redisConnection, concurrency: 5 },
  );
  worker.on('failed', (job, err) => {
    logger.error('Email job failed', { jobId: job?.id, error: err.message });
  });
  return worker;
}

export async function enqueueEmail(data: EmailJobData) {
  try {
    await emailQueue.add('send', data);
  } catch (err) {
    // Redis/queue unavailable fall back to sending directly so the email
    // still goes out instead of being silently dropped.
    logger.warn('Email queue unavailable sending directly instead', { to: data.to, error: (err as Error).message });
    try {
      await sendEmailNow(data);
    } catch (sendErr) {
      logger.error('Direct email send failed', { to: data.to, error: (sendErr as Error).message });
    }
  }
}
