// server/src/modules/curricula/curriculum-materials.ts
import { ResourceModel } from '../resources/resource.model';
import { AssignmentModel } from '../assignments/assignment.model';
import { WorksheetModel } from '../worksheets/worksheet.model';
import { NotFoundError, ValidationError } from '../../utils/error';
import type { MaterialKind } from '../courses/course-structure';

const MODELS = { resource: ResourceModel, assignment: AssignmentModel, worksheet: WorksheetModel } as const;

/** Soft-deletes an admin-authored item of this curriculum. Tutor items are the tutor's to delete. */
export async function softDeleteCurriculumMaterial(kind: string, curriculumPublicId: string, materialPublicId: string): Promise<void> {
  if (!(kind in MODELS)) throw new ValidationError({ kind: ['kind must be resource, assignment or worksheet'] });
  const Model = MODELS[kind as MaterialKind] as typeof ResourceModel;
  const done = await Model.findOneAndUpdate(
    { publicId: materialPublicId, curriculumPublicId, authorRole: 'ADMIN', isDeleted: false },
    { $set: { isDeleted: true } },
  ).lean();
  if (!done) throw new NotFoundError('Material');
}
