import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../shared/types';
import { requireAuth } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/permission.middleware';
import { Role } from '../../constants/roles';
import { systemService } from './system.service';
import { integrationsService } from './integrations.service';
import { sendSuccess } from '../../utils/response';

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

export { router as systemRouter };
