import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../shared/types';
import { curriculumService } from './curriculum.service';
import { sendSuccess, sendCreated } from '../../utils/response';
import { NotFoundError, ValidationError } from '../../utils/error';
import { curriculumAdminOverviewQuerySchema, curriculumStateCatalogQuerySchema, curriculumImportQuerySchema } from './curriculum.validators';
import { importCurriculumDocx } from './import/curriculum-docx-import';
import { tutorService } from '../tutors/tutor.service';
import { listAttachableCurricula } from './curriculum-attachment';
import { getCurriculumStructure } from '../courses/course-structure';
import { softDeleteCurriculumMaterial } from './curriculum-materials';
import { resourceService } from '../resources/resource.service';
import { assignmentService } from '../assignments/assignment.service';
import { worksheetService } from '../worksheets/worksheet.service';

export class CurriculumController {
  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await curriculumService.create(req.user!.publicId, req.body);
      sendCreated(res, result, 'Curriculum created');
    } catch (error) { next(error); }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await curriculumService.update(req.params.curriculumPublicId, req.body);
      sendSuccess(res, result, 'Curriculum updated');
    } catch (error) { next(error); }
  }

  async publish(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await curriculumService.setPublished(req.params.curriculumPublicId, true);
      sendSuccess(res, result, 'Curriculum published');
    } catch (error) { next(error); }
  }

  async unpublish(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await curriculumService.setPublished(req.params.curriculumPublicId, false);
      sendSuccess(res, result, 'Curriculum unpublished');
    } catch (error) { next(error); }
  }

  async remove(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await curriculumService.softDelete(req.params.curriculumPublicId);
      sendSuccess(res, null, 'Curriculum deleted');
    } catch (error) { next(error); }
  }

  async createResource(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try { sendCreated(res, await resourceService.createForCurriculum(req.user!.publicId, req.params.curriculumPublicId, req.body), 'Resource added'); }
    catch (error) { next(error); }
  }
  async createAssignment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try { sendCreated(res, await assignmentService.createForCurriculum(req.user!.publicId, req.params.curriculumPublicId, req.body), 'Assignment added'); }
    catch (error) { next(error); }
  }
  async createWorksheet(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try { sendCreated(res, await worksheetService.createForCurriculum(req.user!.publicId, req.params.curriculumPublicId, req.body), 'Worksheet added'); }
    catch (error) { next(error); }
  }
  async deleteMaterial(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await softDeleteCurriculumMaterial(req.params.kind, req.params.curriculumPublicId, req.params.materialPublicId);
      sendSuccess(res, null, 'Material deleted');
    } catch (error) { next(error); }
  }

  async getStructure(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, await getCurriculumStructure(req.params.curriculumPublicId), 'Curriculum structure fetched');
    } catch (error) { next(error); }
  }

  /** Curricula the calling tutor/principal may attach materials to. */
  async listAttachable(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tutor = await tutorService.getByUserPublicId(req.user!.publicId);
      const result = await listAttachableCurricula({ subjects: tutor.subjects ?? [], gradesTaught: tutor.gradesTaught });
      sendSuccess(res, result, 'Attachable curricula fetched');
    } catch (error) { next(error); }
  }

  /** Tutor picker for a curriculum: ACTIVE tutors teaching its subject + grade. */
  async listTutors(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const curriculum = await curriculumService.getByPublicId(req.params.curriculumPublicId);
      const isAdmin = req.user!.role === 'ADMIN' || req.user!.role === 'SUPER_ADMIN';
      if (!isAdmin && !curriculum.isPublished) throw new NotFoundError('Curriculum');
      const tutors = await tutorService.findForCurriculum({ subject: curriculum.subject, grade: curriculum.grade });
      sendSuccess(res, tutors, 'Tutors fetched');
    } catch (error) { next(error); }
  }

  async getByPublicId(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const isAdmin = req.user!.role === 'ADMIN' || req.user!.role === 'SUPER_ADMIN';
      const result = await curriculumService.getByPublicId(req.params.curriculumPublicId, { forStudent: !isAdmin });
      if (!isAdmin && !result.isPublished) {
        // Don't reveal that an unpublished curriculum exists at this id.
        throw new NotFoundError('Curriculum');
      }
      sendSuccess(res, result, 'Curriculum fetched');
    } catch (error) { next(error); }
  }

  /** State-based catalog (any authenticated role). */
  async listByState(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = curriculumStateCatalogQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);
      }
      const result = await curriculumService.listByState(parsed.data);
      sendSuccess(res, result, 'Curricula fetched');
    } catch (error) { next(error); }
  }

  /** Admin: states that have curricula, with published counts. */
  async adminStates(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, await curriculumService.listAdminStates(), 'States fetched');
    } catch (error) { next(error); }
  }

  /** Admin: preview (default) or commit a Word-file import for one state. Writes drafts only. */
  async importDocx(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = curriculumImportQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);
      }
      const file = req.body;
      if (!Buffer.isBuffer(file) || file.length === 0) {
        throw new ValidationError({ file: ['Attach a .docx file'] });
      }
      const { commit, ...rest } = parsed.data;
      const report = await importCurriculumDocx(file, rest, commit);
      sendSuccess(res, { committed: commit, report }, commit ? 'Curricula imported as drafts' : 'Import preview ready');
    } catch (error) { next(error); }
  }

  /** Admin: publish all draft curricula of a state in one go. */
  async publishState(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await curriculumService.publishAllForState(req.body.stateCode);
      sendSuccess(res, result, `${result.published} curricula published`);
    } catch (error) { next(error); }
  }

  /** Admin: every curriculum of one state (grade → subject view). */
  async adminOverview(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = curriculumAdminOverviewQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);
      }
      sendSuccess(res, await curriculumService.listAdminOverview(parsed.data.stateCode), 'Curricula fetched');
    } catch (error) { next(error); }
  }
}

export const curriculumController = new CurriculumController();
