import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../shared/types';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole, requirePermission } from '../../middlewares/permission.middleware';
import { Permission } from '../../constants/permissions';
import { Role } from '../../constants/roles';
import { principalService } from './principal.service';
import { sendSuccess, sendPaginated } from '../../utils/response';

const router = Router();
router.use(authMiddleware);

router.get('/me', requireRole(Role.PRINCIPAL), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const profile = await principalService.getByUserPublicId(req.user!.publicId);
    sendSuccess(res, profile, 'Principal profile fetched');
  } catch (e) { next(e); }
});

router.get('/pending', requirePermission(Permission.APPROVE_PRINCIPALS), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await principalService.listPending(req.query);
    sendPaginated(res, result, 'Pending principals fetched');
  } catch (e) { next(e); }
});

router.get('/', requirePermission(Permission.MANAGE_PRINCIPALS), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await principalService.listAll(req.query);
    sendPaginated(res, result, 'Principals fetched');
  } catch (e) { next(e); }
});

router.get('/:principalId', requirePermission(Permission.MANAGE_PRINCIPALS), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const profile = await principalService.getByPublicId(req.params.principalId);
    sendSuccess(res, profile, 'Principal fetched');
  } catch (e) { next(e); }
});

router.post('/:principalId/approve', requirePermission(Permission.APPROVE_PRINCIPALS), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const profile = await principalService.approve(req.params.principalId, req.user!.publicId);
    sendSuccess(res, profile, 'Principal approved');
  } catch (e) { next(e); }
});

router.post('/:principalId/suspend', requirePermission(Permission.MANAGE_PRINCIPALS), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const profile = await principalService.suspend(req.params.principalId);
    sendSuccess(res, profile, 'Principal suspended');
  } catch (e) { next(e); }
});

export default router;
