import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from './logger';

export async function verifySmtpConnection(): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  try {
    await transporter.verify();
    logger.info('SMTP connection verified', {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      user: env.SMTP_USER,
    });
  } catch (err) {
    logger.error('SMTP connection failed', {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      user: env.SMTP_USER,
      error: (err as Error).message,
    });
  }
}
