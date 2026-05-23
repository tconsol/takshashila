import { Router } from 'express';
import { authController } from './auth.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validation.middleware';
import { authRateLimiter, passwordResetLimiter } from '../../middlewares/rateLimit.middleware';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  changePasswordSchema,
  refreshTokenSchema,
  acceptInviteSchema,
} from './auth.validators';

const router = Router();

router.post('/register', authRateLimiter, validate(registerSchema), authController.register.bind(authController));
router.post('/login', authRateLimiter, validate(loginSchema), authController.login.bind(authController));
router.post('/refresh', validate(refreshTokenSchema), authController.refreshTokens.bind(authController));
router.post('/verify-email', validate(verifyEmailSchema), authController.verifyEmail.bind(authController));
router.post('/accept-invite', validate(acceptInviteSchema), authController.acceptInvite.bind(authController));
router.post('/forgot-password', passwordResetLimiter, validate(forgotPasswordSchema), authController.forgotPassword.bind(authController));
router.post('/reset-password', passwordResetLimiter, validate(resetPasswordSchema), authController.resetPassword.bind(authController));

router.use(authMiddleware);
router.get('/me', authController.getMe.bind(authController));
router.post('/logout', authController.logout.bind(authController));
router.post('/logout-all', authController.logoutAllDevices.bind(authController));
router.post('/change-password', validate(changePasswordSchema), authController.changePassword.bind(authController));
router.get('/sessions', authController.listActiveSessions.bind(authController));
router.delete('/sessions/:sessionId', authController.revokeSession.bind(authController));

export default router;
