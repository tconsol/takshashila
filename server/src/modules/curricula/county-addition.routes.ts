import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import type { ZodTypeAny, z } from 'zod';
import type { AuthRequest } from '../../shared/types';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/permission.middleware';
import { validate } from '../../middlewares/validation.middleware';
import { Role } from '../../constants/roles';
import { sendSuccess, sendCreated } from '../../utils/response';
import { ValidationError } from '../../utils/error';
import { countyAdditionService } from './county-addition.service';
import {
  createCountyAdditionSchema, updateCountyAdditionSchema, countyAdditionAdminQuerySchema, countyAdditionPublicQuerySchema,
  publishAllCountyAdditionsSchema,
} from './county-addition.validators';

const router = Router();
router.use(authMiddleware);

const ADMINS = requireRole(Role.SUPER_ADMIN, Role.ADMIN);
const handle = (fn: (req: AuthRequest, res: Response) => Promise<void>) =>
  async (req: AuthRequest, res: Response, next: NextFunction) => { try { await fn(req, res); } catch (e) { next(e); } };

function parseQuery<S extends ZodTypeAny>(schema: S, query: unknown): z.infer<S> {
  const parsed = schema.safeParse(query);
  if (!parsed.success) throw new ValidationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);
  return parsed.data;
}

/** Published add-ons for one county (students, parents and anyone signed in). */
router.get('/', handle(async (req, res) => {
  const q = parseQuery(countyAdditionPublicQuerySchema, req.query);
  sendSuccess(res, await countyAdditionService.listForCounty(q), 'County add-ons fetched');
}));

router.get('/admin', ADMINS, handle(async (req, res) => {
  const q = parseQuery(countyAdditionAdminQuerySchema, req.query);
  sendSuccess(res, await countyAdditionService.listAdmin(q.stateCode), 'County add-ons fetched');
}));

router.post('/', ADMINS, validate(createCountyAdditionSchema), handle(async (req, res) => {
  sendCreated(res, await countyAdditionService.create(req.body), 'County add-on created');
}));

router.post('/publish-all', ADMINS, validate(publishAllCountyAdditionsSchema), handle(async (req, res) => {
  const result = await countyAdditionService.publishAllDrafts(req.body);
  sendSuccess(res, result, `${result.published} county add-on(s) published`);
}));

router.put('/:publicId', ADMINS, validate(updateCountyAdditionSchema), handle(async (req, res) => {
  sendSuccess(res, await countyAdditionService.update(req.params.publicId, req.body), 'County add-on updated');
}));

router.post('/:publicId/publish', ADMINS, handle(async (req, res) => {
  sendSuccess(res, await countyAdditionService.setPublished(req.params.publicId, true), 'County add-on published');
}));

router.post('/:publicId/unpublish', ADMINS, handle(async (req, res) => {
  sendSuccess(res, await countyAdditionService.setPublished(req.params.publicId, false), 'County add-on unpublished');
}));

router.delete('/:publicId', ADMINS, handle(async (req, res) => {
  await countyAdditionService.remove(req.params.publicId);
  sendSuccess(res, null, 'County add-on deleted');
}));

export default router;
