import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../shared/types';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { userService } from './user.service';
import { sendSuccess } from '../../utils/response';

const router = Router();
router.use(authMiddleware);

router.get('/me', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await userService.getByPublicId(req.user!.publicId);
    sendSuccess(res, user, 'User profile fetched');
  } catch (e) { next(e); }
});

router.patch('/me', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { firstName, lastName, phone, avatarUrl, timezone } = req.body;
    const updated = await userService.updateProfile(req.user!.publicId, {
      firstName, lastName, phone, avatarUrl, timezone,
    });
    sendSuccess(res, updated, 'Profile updated');
  } catch (e) { next(e); }
});

export default router;
