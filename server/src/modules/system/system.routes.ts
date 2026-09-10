import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../shared/types';
import { requireAuth } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/permission.middleware';
import { Role } from '../../constants/roles';
import { systemService } from './system.service';
import { integrationsService } from './integrations.service';
import { contentOversightService } from './content-oversight.service';
import type { ContentKind } from './content-oversight.service';
import { sendSuccess, sendPaginated } from '../../utils/response';

const router = Router();
router.use(requireAuth);
// Admins run day-to-day operations, so they need to see a failing bucket or SMTP
// host too. No secrets are exposed here — only reachability and config presence.
router.use(requireRole(Role.SUPER_ADMIN, Role.ADMIN));

router.get('/health', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await systemService.getHealth(), 'System health fetched');
  } catch (e) { next(e); }
});

/** Third-party health on its own, for a panel that refreshes independently. */
router.get('/integrations', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await integrationsService.getAll(), 'Integration health fetched');
  } catch (e) { next(e); }
});

/**
 * Drops the probe cache and re-checks immediately. After fixing a credential
 * you want an answer now, not in up to a minute.
 */
router.post('/integrations/recheck', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    integrationsService.invalidate();
    sendSuccess(res, await integrationsService.getAll(), 'Integrations re-checked');
  } catch (e) { next(e); }
});

/** Failed jobs for one queue, with the reason each failed. */
router.get('/queues/:queue/failed', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const jobs = await systemService.getFailedJobs(req.params.queue, Number(req.query.limit ?? 20));
    sendSuccess(res, jobs, 'Failed jobs fetched');
  } catch (e) { next(e); }
});

router.post('/queues/:queue/failed/:jobId/retry', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await systemService.retryFailedJob(req.params.queue, req.params.jobId);
    sendSuccess(res, null, 'Job re-queued');
  } catch (e) { next(e); }
});

router.delete('/queues/:queue/failed', requireRole(Role.SUPER_ADMIN), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const removed = await systemService.clearFailedJobs(req.params.queue);
    sendSuccess(res, { removed }, `${removed} failed jobs cleared`);
  } catch (e) { next(e); }
});

// ─── Content oversight ──────────────────────────────────────────────────────

router.get('/content', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { kind, q, includeDeleted, ...pagination } = req.query as Record<string, string>;
    const result = await contentOversightService.list(
      { kind: kind as ContentKind | undefined, q, includeDeleted: includeDeleted === 'true' },
      pagination,
    );
    sendPaginated(res, result, 'Content fetched');
  } catch (e) { next(e); }
});

router.get('/content/counts', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await contentOversightService.counts(), 'Content counts fetched');
  } catch (e) { next(e); }
});

router.delete('/content/:kind/:publicId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await contentOversightService.remove(
      req.params.kind as ContentKind,
      req.params.publicId,
      { publicId: req.user!.publicId, role: req.user!.role, ip: req.ip, userAgent: req.get('user-agent') },
      req.body?.reason,
    );
    sendSuccess(res, null, 'Content removed');
  } catch (e) { next(e); }
});

router.post('/content/:kind/:publicId/restore', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await contentOversightService.restore(
      req.params.kind as ContentKind,
      req.params.publicId,
      { publicId: req.user!.publicId, role: req.user!.role, ip: req.ip, userAgent: req.get('user-agent') },
    );
    sendSuccess(res, null, 'Content restored');
  } catch (e) { next(e); }
});

// ─── Email delivery ─────────────────────────────────────────────────────────
// Reflects the SMTP handoff only. Bounce tracking needs a provider webhook —
// see email-log.model.ts.

router.get('/email/stats', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const days = Number(req.query.days ?? 7);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const { EmailLogModel } = await import('../notifications/email-log.model');

    const [byStatus, recentFailures] = await Promise.all([
      EmailLogModel.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      EmailLogModel.find(
        { status: { $in: ['FAILED', 'REJECTED'] }, createdAt: { $gte: since } },
        { to: 1, subject: 1, status: 1, detail: 1, createdAt: 1 },
      ).sort({ createdAt: -1 }).limit(25).lean(),
    ]);

    const counts = Object.fromEntries(
      byStatus.map((r: { _id: string; count: number }) => [r._id, r.count]),
    ) as Record<string, number>;
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const failed = (counts.FAILED ?? 0) + (counts.REJECTED ?? 0);

    sendSuccess(res, {
      periodDays: days,
      total,
      accepted: counts.ACCEPTED ?? 0,
      rejected: counts.REJECTED ?? 0,
      failed: counts.FAILED ?? 0,
      failureRatePercent: total > 0 ? Math.round((failed / total) * 10000) / 100 : 0,
      recentFailures,
      // Stated explicitly so nobody reads "accepted" as "delivered".
      note: 'Reflects SMTP handoff only. Messages accepted by the relay may still bounce; bounce tracking requires a provider webhook.',
    }, 'Email stats fetched');
  } catch (e) { next(e); }
});

export { router as systemRouter };
