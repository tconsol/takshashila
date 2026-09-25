// server/src/modules/courses/course-structure.ts
import { CurriculumModel } from '../curricula/curriculum.model';
import { ResourceModel } from '../resources/resource.model';
import { AssignmentModel } from '../assignments/assignment.model';
import { WorksheetModel } from '../worksheets/worksheet.model';
import { TutorProfileModel } from '../tutors/tutor.model';
import { UserModel } from '../users/user.model';
import { NotFoundError } from '../../utils/error';
import type { ICurriculum } from '../curricula/curriculum.types';

export type MaterialKind = 'resource' | 'assignment' | 'worksheet';
export interface StructureMaterial {
  kind: MaterialKind;
  publicId: string;
  title: string;
  authorRole: 'TUTOR' | 'ADMIN';
  authorName: string;
}

interface RawMaterial {
  publicId: string;
  title: string;
  topicPublicIds?: string[];
  authorRole?: 'TUTOR' | 'ADMIN';
  authorUserPublicId?: string;
  tutorPublicId?: string;
}

const PROJECTION = { publicId: 1, title: 1, topicPublicIds: 1, authorRole: 1, authorUserPublicId: 1, tutorPublicId: 1 };

/** Loads materials matching `filter` from all three collections, with author names, grouped by topic. */
export async function loadMaterialsByTopic(filter: Record<string, unknown>): Promise<Map<string, StructureMaterial[]>> {
  const [resources, assignments, worksheets] = await Promise.all([
    ResourceModel.find(filter, PROJECTION).lean() as Promise<RawMaterial[]>,
    AssignmentModel.find(filter, PROJECTION).lean() as Promise<RawMaterial[]>,
    WorksheetModel.find(filter, PROJECTION).lean() as Promise<RawMaterial[]>,
  ]);
  const all: Array<RawMaterial & { kind: MaterialKind }> = [
    ...resources.map((m) => ({ ...m, kind: 'resource' as const })),
    ...assignments.map((m) => ({ ...m, kind: 'assignment' as const })),
    ...worksheets.map((m) => ({ ...m, kind: 'worksheet' as const })),
  ];

  const tutorIds = [...new Set(all.flatMap((m) => (m.tutorPublicId ? [m.tutorPublicId] : [])))];
  const tutors = tutorIds.length ? await TutorProfileModel.find({ publicId: { $in: tutorIds } }, { publicId: 1, userPublicId: 1 }).lean() : [];
  const userByTutor = new Map(tutors.map((t) => [t.publicId, t.userPublicId]));
  const userIds = [...new Set([
    ...tutors.map((t) => t.userPublicId),
    ...all.flatMap((m) => (m.authorUserPublicId ? [m.authorUserPublicId] : [])),
  ])];
  const users = userIds.length ? await UserModel.find({ publicId: { $in: userIds } }, { publicId: 1, firstName: 1, lastName: 1 }).lean() : [];
  const nameByUser = new Map(users.map((u) => [u.publicId, `${u.firstName} ${u.lastName}`.trim()]));

  const byTopic = new Map<string, StructureMaterial[]>();
  for (const m of all) {
    const authorUser = m.authorUserPublicId ?? (m.tutorPublicId ? userByTutor.get(m.tutorPublicId) : undefined);
    const item: StructureMaterial = {
      kind: m.kind,
      publicId: m.publicId,
      title: m.title,
      authorRole: m.authorRole ?? 'TUTOR',
      authorName: (authorUser && nameByUser.get(authorUser)) || (m.authorRole === 'ADMIN' ? 'Admin' : 'Tutor'),
    };
    for (const t of m.topicPublicIds ?? []) byTopic.set(t, [...(byTopic.get(t) ?? []), item]);
  }
  return byTopic;
}

export const curriculumSummary = (c: ICurriculum) => ({
  publicId: c.publicId,
  title: c.title,
  subject: c.subject,
  grade: c.grade,
  district: c.district,
  state: c.state,
});

export async function getCurriculumStructure(curriculumPublicId: string) {
  const curriculum = await CurriculumModel.findOne({ publicId: curriculumPublicId, isDeleted: false }).lean();
  if (!curriculum) throw new NotFoundError('Curriculum');
  const byTopic = await loadMaterialsByTopic({ curriculumPublicId, isDeleted: false });
  return {
    curriculum: curriculumSummary(curriculum),
    topics: [...curriculum.topics]
      .sort((a, b) => a.order - b.order)
      .map((t) => ({ publicId: t.publicId, title: t.title, order: t.order, materials: byTopic.get(t.publicId) ?? [] })),
  };
}
export type CurriculumStructure = Awaited<ReturnType<typeof getCurriculumStructure>>;
