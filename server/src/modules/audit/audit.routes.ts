import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../shared/types';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/permission.middleware';
import { Role } from '../../constants/roles';
import { auditService } from './audit.service';
import { sendPaginated, sendSuccess } from '../../utils/response';
import { toCsv } from '../../utils/csv';

const router = Router();
router.use(authMiddleware);
router.use(requireRole(Role.SUPER_ADMIN, Role.ADMIN));

function filtersFrom(query: Record<string, string>) {
  const { actorId, actorRole, action, resourceType, resourceId, from, to, q } = query;
  return { actorId, actorRole, action, resourceType, resourceId, from, to, q };
}

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const query = req.query as Record<string, string>;
    const { actorId, actorRole, action, resourceType, resourceId, from, to, q, ...pagination } = query;
    void actorId; void actorRole; void action; void resourceType; void resourceId; void from; void to; void q;

    const result = await auditService.search(filtersFrom(query), pagination);
    sendPaginated(res, result, 'Audit logs fetched');
  } catch (e) { next(e); }
});

// Distinct values behind the console's filter dropdowns.
router.get('/facets', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await auditService.getFacets(), 'Audit facets fetched');
  } catch (e) { next(e); }
});

router.get('/export', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const query = req.query as Record<string, string>;
    const rows = await auditService.exportRows(filtersFrom(query), Number(query.max ?? 5000));

    const csv = toCsv(rows, [
      { key: 'createdAt', header: 'Timestamp' },
      { key: 'actorId', header: 'Actor ID' },
      { key: 'actorRole', header: 'Actor Role' },
      { key: 'action', header: 'Action' },
      { key: 'resourceType', header: 'Resource Type' },
      { key: 'resourceId', header: 'Resource ID' },
      { key: 'ip', header: 'IP' },
      { key: 'userAgent', header: 'User Agent' },
    ]);

    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="audit-log-${stamp}.csv"`);
    res.send(csv);
  } catch (e) { next(e); }
});

export default router;
