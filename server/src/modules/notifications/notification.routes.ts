import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware';
import { notificationService } from './notification.service';
import { broadcastService } from './broadcast.service';
import { requireRole } from '../../middlewares/permission.middleware';
import { Role } from '../../constants/roles';
import { sendSuccess } from '../../utils/response';
import type { AuthRequest } from '../../shared/types';

const router = Router();

router.use(requireAuth);

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await notificationService.getForUser(req.user!.publicId, req.query as never);
    res.json(result);
  } catch (e) { next(e); }
});

router.get('/unread-count', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const count = await notificationService.getUnreadCount(req.user!.publicId);
    res.json({ count });
  } catch (e) { next(e); }
});

router.patch('/:publicId/read', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await notificationService.markRead(req.params.publicId, req.user!.publicId);
    res.json({ success: true });
  } catch (e) { next(e); }
});

router.patch('/read-all', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await notificationService.markAllRead(req.user!.publicId);
    res.json({ success: true });
  } catch (e) { next(e); }
});

router.delete('/:publicId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await notificationService.deleteOne(req.params.publicId, req.user!.publicId);
    res.json({ success: true });
  } catch (e) { next(e); }
});

// ─── Admin broadcasts ───────────────────────────────────────────────────────

router.get('/broadcast/audience', requireRole(Role.SUPER_ADMIN, Role.ADMIN), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const roles = String(req.query.roles ?? '').split(',').filter(Boolean) as Role[];
    sendSuccess(res, await broadcastService.estimateAudience(roles), 'Audience estimated');
  } catch (e) { next(e); }
});

router.get('/broadcast/history', requireRole(Role.SUPER_ADMIN, Role.ADMIN), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await broadcastService.history(Number(req.query.limit ?? 25)), 'Broadcast history');
  } catch (e) { next(e); }
});

router.post('/broadcast', requireRole(Role.SUPER_ADMIN, Role.ADMIN), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await broadcastService.send(req.body ?? {}, {
      publicId: req.user!.publicId,
      role: req.user!.role,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendSuccess(res, result, `Announcement sent to ${result.delivered} people`);
  } catch (e) { next(e); }
});

export { router as notificationRouter };
