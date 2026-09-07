import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../shared/types';
import { requireAuth } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/permission.middleware';
import { Role } from '../../constants/roles';
import { systemService } from './system.service';
import { sendSuccess } from '../../utils/response';

const router = Router();
router.use(requireAuth);
router.use(requireRole(Role.SUPER_ADMIN));

router.get('/health', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await systemService.getHealth(), 'System health fetched');
  } catch (e) { next(e); }
});

export { router as systemRouter };
