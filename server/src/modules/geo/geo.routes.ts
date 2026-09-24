import { Router, type Request, type Response, type NextFunction } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { geoService } from './geo.service';
import { sendSuccess } from '../../utils/response';
import { NotFoundError } from '../../utils/error';

const router = Router();
router.use(authMiddleware);

// Static reference data — safe to cache on the client for a day.
router.use((_req: Request, res: Response, next: NextFunction) => {
  res.set('Cache-Control', 'private, max-age=86400');
  next();
});

router.get('/countries', (_req, res) => {
  sendSuccess(res, geoService.listCountries(), 'Countries fetched');
});

router.get('/states', (_req, res) => {
  sendSuccess(res, geoService.listStates(), 'States fetched');
});

router.get('/states/:stateCode/counties', (req, res, next) => {
  const counties = geoService.listCounties(req.params.stateCode.toUpperCase());
  if (!counties) return next(new NotFoundError('State'));
  sendSuccess(res, counties, 'Counties fetched');
});

export default router;
