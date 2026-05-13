import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../shared/types';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/permission.middleware';
import { Role } from '../../constants/roles';
import { auditService } from './audit.service';
import { sendPaginated } from '../../utils/response';

const router = Router();
router.use(authMiddleware);
router.use(requireRole(Role.SUPER_ADMIN, Role.ADMIN));

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { actorId, resourceType, resourceId, ...pagination } = req.query as Record<string, string>;
    let result;
    if (resourceType && resourceId) {
      result = await auditService.getByResource(resourceType, resourceId, pagination);
    } else if (actorId) {
      result = await auditService.getByActor(actorId, pagination);
    } else {
      result = await auditService.getAll(pagination);
    }
    sendPaginated(res, result, 'Audit logs fetched');
  } catch (e) { next(e); }
});

export default router;
