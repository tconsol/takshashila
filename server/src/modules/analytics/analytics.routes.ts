import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/permission.middleware';
import { Role } from '../../constants/roles';
import { analyticsService } from './analytics.service';
import type { AuthRequest } from '../../shared/types';

const router = Router();

router.use(requireAuth);

router.get('/platform/overview', requireRole(Role.SUPER_ADMIN, Role.ADMIN), async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try { res.json(await analyticsService.getPlatformOverview()); } catch (e) { next(e); }
});

router.get('/platform/classes', requireRole(Role.SUPER_ADMIN, Role.ADMIN), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json(await analyticsService.getClassStats(Number(req.query.days ?? 30)));
  } catch (e) { next(e); }
});

router.get('/platform/revenue', requireRole(Role.SUPER_ADMIN, Role.ADMIN), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json(await analyticsService.getRevenueByPeriod(Number(req.query.days ?? 30)));
  } catch (e) { next(e); }
});

router.get('/platform/top-tutors', requireRole(Role.SUPER_ADMIN, Role.ADMIN), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json(await analyticsService.getTopTutors(Number(req.query.limit ?? 10)));
  } catch (e) { next(e); }
});

router.get('/platform/assignments', requireRole(Role.SUPER_ADMIN, Role.ADMIN), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json(await analyticsService.getAssignmentStats(Number(req.query.days ?? 30)));
  } catch (e) { next(e); }
});

router.get('/platform/attendance', requireRole(Role.SUPER_ADMIN, Role.ADMIN), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json(await analyticsService.getAttendanceRate(Number(req.query.days ?? 30)));
  } catch (e) { next(e); }
});

router.get('/super-admin/overview', requireRole(Role.SUPER_ADMIN), async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try { res.json(await analyticsService.getSuperAdminDashboard()); } catch (e) { next(e); }
});

router.get('/admin/overview', requireRole(Role.SUPER_ADMIN, Role.ADMIN), async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try { res.json(await analyticsService.getAdminDashboard()); } catch (e) { next(e); }
});

router.get('/principal/me', requireRole(Role.PRINCIPAL), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json(await analyticsService.getPrincipalStats(req.user!.publicId));
  } catch (e) { next(e); }
});

router.get('/tutor/me', requireRole(Role.TUTOR), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json(await analyticsService.getTutorStats(req.user!.publicId));
  } catch (e) { next(e); }
});

router.get('/student/me', requireRole(Role.STUDENT), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json(await analyticsService.getStudentStats(req.user!.publicId));
  } catch (e) { next(e); }
});

export { router as analyticsRouter };
