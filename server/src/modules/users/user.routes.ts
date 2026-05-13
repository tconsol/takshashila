import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../shared/types';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/permission.middleware';
import { Role } from '../../constants/roles';
import { userService } from './user.service';
import { userRepository } from './user.repository';
import { sendSuccess, sendPaginated } from '../../utils/response';

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

// ─── Admin-only user listing & management ────────────────────────────────────
router.get('/', requireRole(Role.SUPER_ADMIN, Role.ADMIN), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { role, ...paginationQuery } = req.query as Record<string, string>;
    if (!role) { sendSuccess(res, [], 'Users fetched'); return; }
    const result = await userRepository.findAllByRole(role as Role, paginationQuery);
    sendPaginated(res, result, 'Users fetched');
  } catch (e) { next(e); }
});

router.post('/:publicId/suspend', requireRole(Role.SUPER_ADMIN, Role.ADMIN), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await userService.suspendUser(req.params.publicId, req.user!.publicId);
    sendSuccess(res, null, 'User suspended');
  } catch (e) { next(e); }
});

router.post('/:publicId/activate', requireRole(Role.SUPER_ADMIN, Role.ADMIN), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await userService.activateUser(req.params.publicId);
    sendSuccess(res, null, 'User activated');
  } catch (e) { next(e); }
});

export default router;
