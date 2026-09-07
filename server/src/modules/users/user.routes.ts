import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../shared/types';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/permission.middleware';
import { Role } from '../../constants/roles';
import { userService } from './user.service';
import { userAdminService } from './user.admin.service';
import { userRepository } from './user.repository';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response';
import { toCsv } from '../../utils/csv';

const router = Router();
router.use(authMiddleware);

const actorFrom = (req: AuthRequest) => ({
  publicId: req.user!.publicId,
  role: req.user!.role,
  ip: req.ip,
  userAgent: req.get('user-agent'),
});

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

// ─── Mobile push token register / unregister ─────────────────────────────────
router.post('/me/push-token', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = String(req.body?.token ?? '').trim();
    if (!token) { sendSuccess(res, null, 'No token'); return; }
    await userRepository.addPushToken(req.user!.publicId, token);
    sendSuccess(res, null, 'Push token registered');
  } catch (e) { next(e); }
});

router.delete('/me/push-token', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = String(req.body?.token ?? '').trim();
    if (token) await userRepository.removePushToken(req.user!.publicId, token);
    sendSuccess(res, null, 'Push token removed');
  } catch (e) { next(e); }
});

// ─── Admin-only search across all users ──────────────────────────────────────
router.get('/search', requireRole(Role.SUPER_ADMIN, Role.ADMIN, Role.SUPPORT), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = String(req.query.q ?? '').trim();
    if (!q || q.length < 2) { sendSuccess(res, [], 'No query'); return; }
    const users = await userRepository.searchAll(q, 40);
    sendSuccess(res, users, 'Users found');
  } catch (e) { next(e); }
});

// ─── Admin-only user listing & management ────────────────────────────────────
router.get('/', requireRole(Role.SUPER_ADMIN, Role.ADMIN), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { role, status, q, deleted, ...paginationQuery } = req.query as Record<string, string>;
    const result = await userAdminService.listDirectory(
      {
        role: role as Role | undefined,
        status,
        q,
        deleted: deleted === 'include' || deleted === 'only' ? deleted : 'exclude',
      },
      paginationQuery,
    );
    sendPaginated(res, result, 'Users fetched');
  } catch (e) { next(e); }
});

// Admin creates an account on someone's behalf — the invitee sets their own password.
router.post('/', requireRole(Role.SUPER_ADMIN, Role.ADMIN), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const created = await userAdminService.createUser(req.body ?? {}, actorFrom(req));
    sendCreated(res, created, 'User created — an invitation email has been sent');
  } catch (e) { next(e); }
});

// CSV of the current filter selection. Capped server-side — an unbounded export
// of every user is a memory spike waiting to happen.
router.get('/export', requireRole(Role.SUPER_ADMIN, Role.ADMIN), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { role, status, q, deleted, max } = req.query as Record<string, string>;
    const rows = await userAdminService.exportUsers(
      {
        role: role as Role | undefined,
        status,
        q,
        deleted: deleted === 'include' || deleted === 'only' ? deleted : 'exclude',
      },
      Number(max ?? 5000),
    );

    const csv = toCsv(rows, [
      { key: 'publicId', header: 'ID' },
      { key: 'firstName', header: 'First Name' },
      { key: 'lastName', header: 'Last Name' },
      { key: 'email', header: 'Email' },
      { key: 'role', header: 'Role' },
      { key: 'status', header: 'Status' },
      { key: 'phone', header: 'Phone' },
      { key: 'timezone', header: 'Timezone' },
      { key: 'emailVerified', header: 'Email Verified' },
      { key: 'lastLoginAt', header: 'Last Login' },
      { key: 'loginCount', header: 'Login Count' },
      { key: 'isDeleted', header: 'Deleted' },
      { key: 'createdAt', header: 'Joined' },
    ]);

    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="users-${role ? `${role.toLowerCase()}-` : ''}${stamp}.csv"`);
    res.send(csv);
  } catch (e) { next(e); }
});

// Aggregate counts for admin dashboards (role split + status split).
router.get('/counts', requireRole(Role.SUPER_ADMIN, Role.ADMIN), async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await userRepository.countsByRoleAndStatus(), 'User counts fetched');
  } catch (e) { next(e); }
});

// Full admin view of one user: account, role profile, wallet, activity, audit trail.
router.get('/:publicId/detail', requireRole(Role.SUPER_ADMIN, Role.ADMIN), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await userAdminService.getUserDetail(req.params.publicId), 'User detail fetched');
  } catch (e) { next(e); }
});

router.post('/:publicId/suspend', requireRole(Role.SUPER_ADMIN, Role.ADMIN), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await userService.suspendUser(req.params.publicId, actorFrom(req), req.body?.reason);
    sendSuccess(res, null, 'User suspended');
  } catch (e) { next(e); }
});

router.post('/:publicId/activate', requireRole(Role.SUPER_ADMIN, Role.ADMIN), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await userService.activateUser(req.params.publicId, actorFrom(req));
    sendSuccess(res, null, 'User activated');
  } catch (e) { next(e); }
});

router.patch('/:publicId', requireRole(Role.SUPER_ADMIN, Role.ADMIN), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const updated = await userAdminService.updateUser(req.params.publicId, req.body ?? {}, actorFrom(req));
    sendSuccess(res, updated, 'User updated');
  } catch (e) { next(e); }
});

// Role-specific profile fields (grade, subjects, commission, organization, …).
router.patch('/:publicId/profile', requireRole(Role.SUPER_ADMIN, Role.ADMIN), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const updated = await userAdminService.updateRoleProfile(req.params.publicId, req.body ?? {}, actorFrom(req));
    sendSuccess(res, updated, 'Profile updated');
  } catch (e) { next(e); }
});

// Soft delete — the row is flagged, never dropped, so history keeps resolving.
router.delete('/:publicId', requireRole(Role.SUPER_ADMIN, Role.ADMIN), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await userAdminService.deleteUser(req.params.publicId, actorFrom(req), req.body?.reason);
    sendSuccess(res, null, 'User deleted');
  } catch (e) { next(e); }
});

// Role changes rewrite what an account can reach, so they are super-admin only.
router.post('/:publicId/role', requireRole(Role.SUPER_ADMIN), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const updated = await userAdminService.changeRole(
      req.params.publicId,
      req.body?.role,
      actorFrom(req),
      req.body?.reason,
    );
    sendSuccess(res, updated, 'Role changed');
  } catch (e) { next(e); }
});

router.post('/:publicId/restore', requireRole(Role.SUPER_ADMIN, Role.ADMIN), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const restored = await userAdminService.restoreUser(req.params.publicId, actorFrom(req));
    sendSuccess(res, restored, 'User restored');
  } catch (e) { next(e); }
});

export default router;
