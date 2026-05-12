import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/permission.middleware';
import { Role } from '../../constants/roles';
import { supportService } from './support.service';
import type { AuthRequest } from '../../shared/types';

const router = Router();

router.use(requireAuth);

const STAFF_ROLES: Role[] = [Role.SUPPORT, Role.ADMIN, Role.SUPER_ADMIN];

router.post('/tickets', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ticket = await supportService.createTicket(req.user!.publicId, req.body);
    res.status(201).json({ success: true, data: ticket });
  } catch (e) { next(e); }
});

router.get('/tickets', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const isStaff = STAFF_ROLES.includes(req.user!.role);
    const filterByRequester = isStaff ? undefined : req.user!.publicId;
    const result = await supportService.listTickets(req.query as never, filterByRequester);
    res.json({ success: true, data: result });
  } catch (e) { next(e); }
});

router.get('/tickets/:publicId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ticket = await supportService.getTicket(req.params.publicId);
    res.json({ success: true, data: ticket });
  } catch (e) { next(e); }
});

router.patch('/tickets/:publicId', requireRole(Role.SUPPORT, Role.ADMIN, Role.SUPER_ADMIN), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const updated = await supportService.updateTicket(req.params.publicId, req.body);
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

router.get('/tickets/:publicId/messages', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const includeInternal = STAFF_ROLES.includes(req.user!.role);
    const messages = await supportService.getMessages(req.params.publicId, includeInternal);
    res.json({ success: true, data: messages });
  } catch (e) { next(e); }
});

router.post('/tickets/:publicId/messages', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const msg = await supportService.addMessage(req.params.publicId, req.user!.publicId, req.body);
    res.status(201).json({ success: true, data: msg });
  } catch (e) { next(e); }
});

router.delete('/tickets/:publicId', requireRole(Role.SUPPORT, Role.ADMIN, Role.SUPER_ADMIN), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await supportService.deleteTicket(req.params.publicId);
    res.json({ success: true });
  } catch (e) { next(e); }
});

export { router as supportRouter };
