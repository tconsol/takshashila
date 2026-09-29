import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/permission.middleware';
import { Role } from '../../constants/roles';
import { supportService } from './support.service';
import { TicketCategory } from './support.types';
import { ValidationError } from '../../utils/error';
import type { AuthRequest } from '../../shared/types';

const router = Router();

router.use(requireAuth);

const STAFF_ROLES: Role[] = [Role.SUPPORT, Role.ADMIN, Role.SUPER_ADMIN];

router.post('/tickets', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { subject, body, category } = req.body ?? {};
    if (typeof subject !== 'string' || subject.trim().length < 3 || subject.length > 200) {
      throw new ValidationError(['Subject must be 3 to 200 characters'], 'Subject must be 3 to 200 characters');
    }
    if (typeof body !== 'string' || body.trim().length < 10 || body.length > 5000) {
      throw new ValidationError(['Please describe the problem (10 to 5000 characters)'], 'Please describe the problem (10 to 5000 characters)');
    }
    if (!Object.values(TicketCategory).includes(category)) {
      throw new ValidationError(['Choose a category'], 'Choose a category');
    }
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

router.get('/agents', requireRole(Role.SUPPORT, Role.ADMIN, Role.SUPER_ADMIN), async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await supportService.listAgents() });
  } catch (e) { next(e); }
});

router.get('/tickets/:publicId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await supportService.assertCanAccess(req.params.publicId, req.user!.publicId, STAFF_ROLES.includes(req.user!.role));
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
    await supportService.assertCanAccess(req.params.publicId, req.user!.publicId, includeInternal);
    const messages = await supportService.getMessages(req.params.publicId, includeInternal);
    res.json({ success: true, data: messages });
  } catch (e) { next(e); }
});

router.post('/tickets/:publicId/messages', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const isStaff = STAFF_ROLES.includes(req.user!.role);
    await supportService.assertCanAccess(req.params.publicId, req.user!.publicId, isStaff);
    // Only staff may write internal notes.
    const body = isStaff ? req.body : { ...req.body, isInternal: false };
    const msg = await supportService.addMessage(req.params.publicId, req.user!.publicId, body);
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
