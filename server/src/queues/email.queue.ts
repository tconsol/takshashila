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

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

export const emailWorker = new Worker<EmailJobData>(
  'email',
  async (job) => {
    const { to, subject, html, text } = job.data;
    await transporter.sendMail({
      from: env.EMAIL_FROM,
      to,
      subject,
      html,
      text,
    });
    logger.info('Email sent', { to, subject });
  },
  { connection: redisConnection, concurrency: 5 },
);

emailWorker.on('failed', (job, err) => {
  logger.error('Email job failed', { jobId: job?.id, error: err.message });
});

export async function enqueueEmail(data: EmailJobData) {
  try {
    await emailQueue.add('send', data);
  } catch (err) {
    // Redis unavailable log and skip; email won't be sent but the caller won't 500
    console.warn('[email] Queue unavailable, skipping email to', data.to, '—', (err as Error).message);
  }
}
