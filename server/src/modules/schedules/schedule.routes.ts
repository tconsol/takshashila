import { Router } from 'express';
import { scheduleController } from './schedule.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/permission.middleware';
import { validate } from '../../middlewares/validation.middleware';
import { Role } from '../../constants/roles';
import { createAvailabilitySlotSchema, getAvailabilityQuerySchema, rescheduleSlotSchema } from './schedule.validators';

const router = Router();
router.use(authMiddleware);

router.post('/slots', requireRole(Role.TUTOR, Role.PRINCIPAL), validate(createAvailabilitySlotSchema), scheduleController.createSlot.bind(scheduleController));
router.get('/slots/me', requireRole(Role.TUTOR, Role.PRINCIPAL), scheduleController.getMySlots.bind(scheduleController));
router.get('/slots/calendar', requireRole(Role.TUTOR, Role.PRINCIPAL), scheduleController.getMyCalendar.bind(scheduleController));
router.delete('/slots/:slotId', requireRole(Role.TUTOR, Role.PRINCIPAL), scheduleController.deleteSlot.bind(scheduleController));
router.patch('/slots/:slotId/cancel', requireRole(Role.TUTOR, Role.PRINCIPAL), scheduleController.cancelSlot.bind(scheduleController));
router.patch('/slots/:slotId/reschedule', requireRole(Role.TUTOR, Role.PRINCIPAL), validate(rescheduleSlotSchema), scheduleController.rescheduleSlot.bind(scheduleController));
router.get('/availability/:tutorId', validate(getAvailabilityQuerySchema, 'query'), scheduleController.getTutorAvailability.bind(scheduleController));

export default router;
