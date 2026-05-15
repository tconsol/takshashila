import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';

import { env } from './config/env';
import { requestLogger } from './middlewares/requestLogger.middleware';
import { globalRateLimiter } from './middlewares/rateLimit.middleware';
import { errorMiddleware, notFoundMiddleware } from './middlewares/error.middleware';

import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/users/user.routes';
import walletRoutes from './modules/wallets/wallet.routes';
import tutorRoutes from './modules/tutors/tutor.routes';
import studentRoutes from './modules/students/student.routes';
import principalRoutes from './modules/principals/principal.routes';
import scheduleRoutes from './modules/schedules/schedule.routes';
import classRoutes from './modules/classes/class.routes';
import attendanceRoutes from './modules/attendance/attendance.routes';
import assignmentRoutes from './modules/assignments/assignment.routes';
import auditRoutes from './modules/audit/audit.routes';
import mediaRoutes from './modules/media/media.routes';
import { notificationRouter } from './modules/notifications/notification.routes';
import { paymentRouter } from './modules/payments/payment.routes';
import { supportRouter } from './modules/support/support.routes';
import { analyticsRouter } from './modules/analytics/analytics.routes';
import { chatRouter } from './modules/chat/chat.routes';
import { ratingRouter } from './modules/ratings/rating.routes';
import parentRoutes from './modules/parents/parent.routes';
import worksheetRoutes from './modules/worksheets/worksheet.routes';
import joinRequestRoutes from './modules/join-requests/join-request.routes';
import { badgesRouter } from './modules/badges/badges.routes';
import demoRequestRoutes from './modules/demo-requests/demo-request.routes';

const app = express();

app.set('trust proxy', 1);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Type'],
}));

app.use(compression());
app.use('/api/v1/payments/stripe/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser(env.COOKIE_SECRET));
app.use(requestLogger);
app.use(globalRateLimiter);

const API_BASE = `/api/${env.API_VERSION}`;

app.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));
app.get('/health/db', async (_req, res) => {
  const mongoose = await import('mongoose');
  const state = mongoose.default.connection.readyState;
  res.json({ status: state === 1 ? 'ok' : 'degraded', state });
});
app.get('/health/redis', async (_req, res) => {
  try {
    const { getRedisClient } = await import('./config/redis');
    await getRedisClient().ping();
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'degraded' });
  }
});

app.use(`${API_BASE}/auth`, authRoutes);
app.use(`${API_BASE}/users`, userRoutes);
app.use(`${API_BASE}/wallets`, walletRoutes);
app.use(`${API_BASE}/tutors`, tutorRoutes);
app.use(`${API_BASE}/students`, studentRoutes);
app.use(`${API_BASE}/principals`, principalRoutes);
app.use(`${API_BASE}/schedules`, scheduleRoutes);
app.use(`${API_BASE}/classes`, classRoutes);
app.use(`${API_BASE}/attendance`, attendanceRoutes);
app.use(`${API_BASE}/assignments`, assignmentRoutes);
app.use(`${API_BASE}/audit`, auditRoutes);
app.use(`${API_BASE}/media`, mediaRoutes);
app.use(`${API_BASE}/notifications`, notificationRouter);
app.use(`${API_BASE}/payments`, paymentRouter);
app.use(`${API_BASE}/support`, supportRouter);
app.use(`${API_BASE}/chat`, chatRouter);
app.use(`${API_BASE}/ratings`, ratingRouter);
app.use(`${API_BASE}/analytics`, analyticsRouter);
app.use(`${API_BASE}/parents`, parentRoutes);
app.use(`${API_BASE}/worksheets`, worksheetRoutes);
app.use(`${API_BASE}/join-requests`, joinRequestRoutes);
app.use(`${API_BASE}/badges`, badgesRouter);
app.use(`${API_BASE}/demo-requests`, demoRequestRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
