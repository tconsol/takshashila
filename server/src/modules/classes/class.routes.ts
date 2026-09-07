import { Router } from 'express';
import { classController } from './class.controller';
import { classService } from './class.service';
import { sendPaginated } from '../../utils/response';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/permission.middleware';
import { validate } from '../../middlewares/validation.middleware';
import { Role } from '../../constants/roles';
import {
  bookClassSchema,
  cancelClassSchema,
  setMeetingUrlSchema,
  classQuerySchema,
  saveRecordingSchema,
  tutorCreateClassSchema,
  tutorRescheduleSchema,
} from './class.validators';

const router = Router();
router.use(authMiddleware);

router.post('/tutor/create', requireRole(Role.TUTOR, Role.PRINCIPAL), validate(tutorCreateClassSchema), classController.tutorCreateClass.bind(classController));
router.get('/my/principal', requireRole(Role.PRINCIPAL), classController.getLiveClassesAsPrincipal.bind(classController));
router.get('/my/tutor', requireRole(Role.TUTOR, Role.PRINCIPAL), validate(classQuerySchema, 'query'), classController.getMyClassesAsTutor.bind(classController));
router.get('/my/student', requireRole(Role.STUDENT), validate(classQuerySchema, 'query'), classController.getMyClassesAsStudent.bind(classController));
router.post('/book', requireRole(Role.STUDENT), validate(bookClassSchema), classController.bookClass.bind(classController));
// Platform-wide class listing for admin finance/ops screens.
router.get('/admin/list', requireRole(Role.SUPER_ADMIN, Role.ADMIN), async (req, res, next) => {
  try {
    const { status, refundable, refunded, days, ...pagination } = req.query as Record<string, string>;
    const result = await classService.listForAdmin(
      {
        status,
        refundable: refundable === 'true',
        refunded: refunded === undefined ? undefined : refunded === 'true',
        days: days ? Number(days) : undefined,
      },
      pagination,
    );
    sendPaginated(res, result, 'Classes fetched');
  } catch (e) { next(e); }
});

router.get('/:classId', classController.getByPublicId.bind(classController));
router.post('/:classId/join', classController.joinClass.bind(classController));
router.post('/:classId/start', requireRole(Role.TUTOR, Role.PRINCIPAL), classController.startClass.bind(classController));
router.post('/:classId/complete', requireRole(Role.TUTOR, Role.PRINCIPAL), classController.completeClass.bind(classController));
router.post('/:classId/cancel', validate(cancelClassSchema), classController.cancelClass.bind(classController));
router.post('/:classId/refund', requireRole(Role.SUPER_ADMIN, Role.ADMIN, Role.PRINCIPAL, Role.TUTOR), validate(cancelClassSchema), classController.refundClass.bind(classController));
router.patch('/:classId/meeting-url', requireRole(Role.TUTOR, Role.PRINCIPAL), validate(setMeetingUrlSchema), classController.setMeetingUrl.bind(classController));
router.patch('/:classId/reschedule-by-tutor', requireRole(Role.TUTOR, Role.PRINCIPAL), validate(tutorRescheduleSchema), classController.tutorReschedule.bind(classController));
router.post('/:classId/recording', requireRole(Role.TUTOR, Role.PRINCIPAL), validate(saveRecordingSchema), classController.saveRecording.bind(classController));
router.get('/:classId/agora-token', classController.getAgoraToken.bind(classController));

export default router;
