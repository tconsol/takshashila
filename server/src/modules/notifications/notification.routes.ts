import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware';
import { notificationService } from './notification.service';
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

export { router as notificationRouter };
