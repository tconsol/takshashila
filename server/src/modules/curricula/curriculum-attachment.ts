// server/src/modules/curricula/curriculum-attachment.ts
import { CurriculumModel } from './curriculum.model';
import { NotFoundError, ValidationError } from '../../utils/error';
import { normalizeSubject } from '../../utils/taxonomy';

export interface AttachableCurriculum {
  publicId: string;
  title: string;
  subject: string;
  grade: string;
  district?: string;
  state: string;
  topics: { publicId: string; title: string; order: number }[];
}

interface TutorScope { subjects: string[]; gradesTaught?: string[] }
interface AttachmentInput { curriculumPublicId?: string; topicPublicIds?: string[] }
export interface AttachmentFields { curriculumPublicId: string; topicPublicIds: string[] }

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const subjectMatcher = (subjects: string[]) =>
  subjects.map((s) => new RegExp(`^${escape(normalizeSubject(s))}$`, 'i'));

/** Published curricula whose subject the tutor teaches (and grade, when grades are set). */
export async function listAttachableCurricula(tutor: TutorScope): Promise<AttachableCurriculum[]> {
  if (tutor.subjects.length === 0) return [];
  const filter: Record<string, unknown> = {
    isPublished: true,
    isDeleted: false,
    subject: { $in: subjectMatcher(tutor.subjects) },
  };
  if (tutor.gradesTaught && tutor.gradesTaught.length > 0) filter.grade = { $in: tutor.gradesTaught };
  const curricula = await CurriculumModel.find(filter).sort({ title: 1 }).limit(200).lean();
  return curricula.map((c) => ({
    publicId: c.publicId,
    title: c.title,
    subject: c.subject,
    grade: c.grade,
    district: c.district,
    state: c.state,
    topics: [...c.topics]
      .sort((a, b) => a.order - b.order)
      .map((t) => ({ publicId: t.publicId, title: t.title, order: t.order })),
  }));
}

function checkTopics(topicIds: string[] | undefined, validIds: Set<string>): string[] {
  const unique = [...new Set(topicIds ?? [])];
  if (unique.length === 0) throw new ValidationError({ topicPublicIds: ['Pick at least one topic'] });
  const bad = unique.filter((id) => !validIds.has(id));
  if (bad.length) throw new ValidationError({ topicPublicIds: [`Not topics of this curriculum: ${bad.join(', ')}`] });
  return unique;
}

/** Validates a tutor's curriculum + topics choice when they create a material. */
export async function resolveTutorAttachment(tutor: TutorScope, input: AttachmentInput): Promise<AttachmentFields> {
  if (!input.curriculumPublicId) throw new ValidationError({ curriculumPublicId: ['Pick a curriculum'] });
  if (!input.topicPublicIds?.length) throw new ValidationError({ topicPublicIds: ['Pick at least one topic'] });
  const curriculum = await CurriculumModel.findOne({ publicId: input.curriculumPublicId, isPublished: true, isDeleted: false }).lean();
  const subjects = new Set(tutor.subjects.map((s) => normalizeSubject(s).toLowerCase()));
  const gradeOk = !tutor.gradesTaught?.length || (curriculum && tutor.gradesTaught.includes(curriculum.grade));
  if (!curriculum || !subjects.has(normalizeSubject(curriculum.subject).toLowerCase()) || !gradeOk) {
    throw new ValidationError({ curriculumPublicId: ['You can only attach to published curricula for subjects and grades you teach'] });
  }
  const topicPublicIds = checkTopics(input.topicPublicIds, new Set(curriculum.topics.map((t) => t.publicId)));
  return { curriculumPublicId: curriculum.publicId, topicPublicIds };
}

/** Admins may attach to any curriculum, published or not. */
export async function resolveAdminAttachment(curriculumPublicId: string, topicPublicIds?: string[]): Promise<AttachmentFields> {
  const curriculum = await CurriculumModel.findOne({ publicId: curriculumPublicId, isDeleted: false }).lean();
  if (!curriculum) throw new NotFoundError('Curriculum');
  return {
    curriculumPublicId,
    topicPublicIds: checkTopics(topicPublicIds, new Set(curriculum.topics.map((t) => t.publicId))),
  };
}
