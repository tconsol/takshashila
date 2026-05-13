import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/permission.middleware';
import { Role } from '../../constants/roles';
import { ratingService } from './rating.service';
import type { AuthRequest } from '../../shared/types';

const router = Router();

router.use(requireAuth);

router.post('/', requireRole(Role.STUDENT), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const rating = await ratingService.submitRating(req.user!.publicId, req.body);
    res.status(201).json(rating);
  } catch (e) { next(e); }
});

router.get('/tutor/:tutorPublicId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json(await ratingService.getRatingsForTutor(req.params.tutorPublicId, req.query as never));
  } catch (e) { next(e); }
});

router.get('/my-class-ids', requireRole(Role.STUDENT), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json(await ratingService.getMyRatedClassIds(req.user!.publicId));
  } catch (e) { next(e); }
});

router.get('/class/:classPublicId/mine', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const rating = await ratingService.getMyRatingForClass(req.params.classPublicId, req.user!.publicId);
    res.json(rating ?? null);
  } catch (e) { next(e); }
});

export { router as ratingRouter };
