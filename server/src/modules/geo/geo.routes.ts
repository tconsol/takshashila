import { Router, type Request, type Response, type NextFunction } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { geoService } from './geo.service';
import { sendSuccess } from '../../utils/response';
import { NotFoundError, ValidationError } from '../../utils/error';

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

router.get('/states/:stateCode/districts', (req, res, next) => {
  const stateCode = req.params.stateCode.toUpperCase();
  const countyFips = typeof req.query.countyFips === 'string' ? req.query.countyFips : undefined;
  const districts = geoService.listDistricts(stateCode, countyFips);
  if (!districts) return next(new NotFoundError('State'));
  if (countyFips && geoService.getCounty(countyFips)?.state !== stateCode) {
    return next(new ValidationError({ countyFips: [`County ${countyFips} is not in state ${stateCode}`] }));
  }
  sendSuccess(res, districts, 'Districts fetched');
});

export default router;
