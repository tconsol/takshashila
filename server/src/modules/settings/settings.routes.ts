import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../shared/types';
import { requireAuth } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/permission.middleware';
import { Role } from '../../constants/roles';
import { LEGAL_VERSION } from '../../config/legal';
import { settingsService } from './settings.service';
import { sendSuccess } from '../../utils/response';

const router = Router();
router.use(requireAuth);

// Any signed-in user may read the few settings that change what they see
// (branding, whether booking is open). Nothing sensitive is included.
router.get('/public', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const s = await settingsService.get();
    sendSuccess(res, {
      legalVersion: LEGAL_VERSION,
      platformName: s.platformName,
      supportEmail: s.supportEmail,
      maintenanceMode: !!s.maintenanceMode,
      maintenanceMessage: s.maintenanceMessage,
      classBookingEnabled: await settingsService.isFeatureEnabled('classBookingEnabled'),
      chatEnabled: await settingsService.isFeatureEnabled('chatEnabled'),
      gamesEnabled: await settingsService.isFeatureEnabled('gamesEnabled'),
    }, 'Public settings fetched');
  } catch (e) { next(e); }
});

// Admins read; only super admins write.
router.get('/platform', requireRole(Role.SUPER_ADMIN, Role.ADMIN), async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await settingsService.get(), 'Platform settings fetched');
  } catch (e) { next(e); }
});

router.put('/platform', requireRole(Role.SUPER_ADMIN), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const updated = await settingsService.update(req.body ?? {}, {
      publicId: req.user!.publicId,
      role: req.user!.role,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendSuccess(res, updated, 'Platform settings updated');
  } catch (e) { next(e); }
});

export { router as settingsRouter };
