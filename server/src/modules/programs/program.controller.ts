// server/src/modules/programs/program.controller.ts
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../shared/types';
import { programService } from './program.service';
import { programEnrollmentService } from './program-enrollment.service';
import { programCatalogQuerySchema } from './program.validators';
import { tutorService } from '../tutors/tutor.service';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response';
import { ValidationError } from '../../utils/error';

const tutorId = async (req: AuthRequest) => (await tutorService.getByUserPublicId(req.user!.publicId)).publicId;
const viewer = (req: AuthRequest) => ({ role: req.user!.role, userPublicId: req.user!.publicId });

function catalogQuery(req: AuthRequest) {
  const parsed = programCatalogQuerySchema.safeParse(req.query);
  if (!parsed.success) throw new ValidationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);
  return parsed.data;
}

type Handler = (req: AuthRequest, res: Response) => Promise<unknown>;
const wrap = (fn: Handler) => (req: AuthRequest, res: Response, next: NextFunction) => fn(req, res).catch(next);

export const programController = {
  catalog: wrap(async (req, res) => sendPaginated(res, await programService.catalog(catalogQuery(req)), 'Programs fetched')),
  mine: wrap(async (req, res) => sendSuccess(res, await programService.listMine(await tutorId(req)), 'Programs fetched')),
  get: wrap(async (req, res) => {
    const isTeacher = req.user!.role === 'TUTOR' || req.user!.role === 'PRINCIPAL';
    const program = await programService.getForViewer(req.params.programPublicId, {
      role: req.user!.role,
      tutorPublicId: isTeacher ? await tutorId(req).catch(() => undefined) : undefined,
    });
    sendSuccess(res, program, 'Program fetched');
  }),
  create: wrap(async (req, res) => sendCreated(res, await programService.create(await tutorId(req), req.body), 'Program created')),
  update: wrap(async (req, res) => sendSuccess(res, await programService.update(await tutorId(req), req.params.programPublicId, req.body), 'Program updated')),
  publish: wrap(async (req, res) => sendSuccess(res, await programService.setStatus(await tutorId(req), req.params.programPublicId, 'PUBLISHED'), 'Program published')),
  archive: wrap(async (req, res) => sendSuccess(res, await programService.setStatus(await tutorId(req), req.params.programPublicId, 'ARCHIVED'), 'Program archived')),
  remove: wrap(async (req, res) => {
    await programService.remove(await tutorId(req), req.params.programPublicId);
    sendSuccess(res, null, 'Program deleted');
  }),
  enrollments: wrap(async (req, res) => sendSuccess(res, await programEnrollmentService.listForProgram(req.user!.publicId, req.params.programPublicId), 'Enrollments fetched')),
  enroll: wrap(async (req, res) => sendCreated(res, await programEnrollmentService.enroll(req.user!.publicId, req.params.programPublicId, req.body), 'Enrolled')),
  myEnrollments: wrap(async (req, res) => sendSuccess(res, await programEnrollmentService.listMine(req.user!.publicId), 'Enrollments fetched')),
  childrenEnrollments: wrap(async (req, res) => sendSuccess(res, await programEnrollmentService.listForParent(req.user!.publicId), 'Enrollments fetched')),
  structure: wrap(async (req, res) => sendSuccess(res, await programEnrollmentService.getStructure(req.params.enrollmentPublicId, viewer(req)), 'Enrollment fetched')),
  scheduleSession: wrap(async (req, res) => sendCreated(res, await programEnrollmentService.scheduleSession(req.params.enrollmentPublicId, req.user!.publicId, req.body), 'Session scheduled')),
  cancel: wrap(async (req, res) => sendSuccess(res, await programEnrollmentService.cancel(req.params.enrollmentPublicId, req.user!.publicId), 'Enrollment cancelled')),
  adminList: wrap(async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    sendPaginated(res, await programService.adminList({ ...catalogQuery(req), status }), 'Programs fetched');
  }),
  unpublish: wrap(async (req, res) => sendSuccess(res, await programService.unpublish(req.params.programPublicId), 'Program unpublished')),
};
