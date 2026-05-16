import { Router } from 'express';
import { joinRequestController } from './join-request.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/permission.middleware';
import { validate } from '../../middlewares/validation.middleware';
import { Role } from '../../constants/roles';
import {
  createTutorRequestSchema,
  createPrincipalRequestSchema,
  rejectRequestSchema,
} from './join-request.validators';

const router = Router();
router.use(authMiddleware);

// Tutor initiates a request to join a principal
router.post(
  '/tutor-request',
  requireRole(Role.TUTOR),
  validate(createTutorRequestSchema),
  joinRequestController.createTutorRequest.bind(joinRequestController),
);

// Principal initiates a request to add a tutor (search by email/phone)
router.post(
  '/principal-request',
  requireRole(Role.PRINCIPAL, Role.ADMIN, Role.SUPER_ADMIN),
  validate(createPrincipalRequestSchema),
  joinRequestController.createPrincipalRequest.bind(joinRequestController),
);

// Search for a tutor by email or phone (principal only)
router.get(
  '/search-tutor',
  requireRole(Role.PRINCIPAL, Role.ADMIN, Role.SUPER_ADMIN),
  joinRequestController.searchTutor.bind(joinRequestController),
);

// Incoming requests directed at me
router.get(
  '/incoming',
  requireRole(Role.TUTOR, Role.PRINCIPAL, Role.ADMIN, Role.SUPER_ADMIN),
  joinRequestController.listIncoming.bind(joinRequestController),
);

// Requests I sent
router.get(
  '/outgoing',
  requireRole(Role.TUTOR, Role.PRINCIPAL, Role.ADMIN, Role.SUPER_ADMIN),
  joinRequestController.listOutgoing.bind(joinRequestController),
);

// Approve / reject / cancel
router.post(
  '/:requestId/approve',
  requireRole(Role.TUTOR, Role.PRINCIPAL),
  joinRequestController.approveRequest.bind(joinRequestController),
);

router.post(
  '/:requestId/reject',
  requireRole(Role.TUTOR, Role.PRINCIPAL),
  validate(rejectRequestSchema),
  joinRequestController.rejectRequest.bind(joinRequestController),
);

router.post(
  '/:requestId/cancel',
  requireRole(Role.TUTOR, Role.PRINCIPAL),
  joinRequestController.cancelRequest.bind(joinRequestController),
);

export default router;
