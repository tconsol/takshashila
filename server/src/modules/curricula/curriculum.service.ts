import { v4 as uuidv4 } from 'uuid';
import { CurriculumModel } from './curriculum.model';
import { HIGH_SCHOOL_GRADE, levelForGrade, type ICurriculum, type ICurriculumChapter } from './curriculum.types';
import type { CreateCurriculumDto, UpdateCurriculumDto, CurriculumChapterInput } from './curriculum.validators';
import { NotFoundError, ConflictError } from '../../utils/error';
import { CourseModel } from '../courses/course.model';
import { CourseStatus } from '../courses/course.types';
import { ResourceModel } from '../resources/resource.model';
import { AssignmentModel } from '../assignments/assignment.model';
import { WorksheetModel } from '../worksheets/worksheet.model';
import { GRADE_LIST } from '../students/student.validators';

/** Admin-only import metadata never sent to students. */
const STUDENT_HIDDEN_FIELDS = { sourceKind: 0, createdByAdminPublicId: 0 } as const;

const ACTIVE_COURSE_STATUSES = [CourseStatus.PENDING, CourseStatus.ACCEPTED];

export interface AdminCurriculumSummary {
  publicId: string;
  title: string;
  subject: string;
  grade: string;
  level: ICurriculum['level'];
  courseName?: string;
  usualGrade?: string;
  isPublished: boolean;
  chapterCount: number;
  topicCount: number;
}

export interface AdminStateSummary { stateCode: string; total: number; published: number }

export class CurriculumService {
  async create(adminUserPublicId: string, dto: CreateCurriculumDto): Promise<ICurriculum> {
    const chapters = mergeChapters([], dto.chapters);
    const created = await CurriculumModel.create({
      publicId: uuidv4(),
      country: 'US',
      stateCode: dto.stateCode,
      grade: dto.grade,
      level: levelForGrade(dto.grade),
      subject: dto.subject,
      title: dto.title,
      description: dto.description,
      courseName: dto.courseName,
      usualGrade: dto.usualGrade,
      chapters,
      topics: chapters.map(({ publicId, title, order }) => ({ publicId, title, order })),
      createdByAdminPublicId: adminUserPublicId,
      isPublished: false,
      isDeleted: false,
    });
    return created.toObject();
  }

  async update(curriculumPublicId: string, dto: UpdateCurriculumDto): Promise<ICurriculum> {
    const { chapters: chaptersInput, ...rest } = dto;
    const setFields: Record<string, unknown> = { ...rest };
    if (dto.grade) setFields.level = levelForGrade(dto.grade);

    if (chaptersInput) {
      const existing = await CurriculumModel.findOne({ publicId: curriculumPublicId, isDeleted: false }).lean();
      if (!existing) throw new NotFoundError('Curriculum');
      const merged = mergeChapters(existing.chapters ?? [], chaptersInput);
      await this.assertRemovalsAllowed(curriculumPublicId, existing.chapters ?? [], merged);
      setFields.chapters = merged;
      setFields.topics = merged.map(({ publicId, title, order }) => ({ publicId, title, order }));
    }

    const updated = await CurriculumModel.findOneAndUpdate(
      { publicId: curriculumPublicId, isDeleted: false },
      { $set: setFields },
      { new: true },
    ).lean();
    if (!updated) throw new NotFoundError('Curriculum');
    return updated;
  }

  /** A chapter or topic that active courses or attached materials use cannot be removed. */
  private async assertRemovalsAllowed(curriculumPublicId: string, before: ICurriculumChapter[], after: ICurriculumChapter[]): Promise<void> {
    const keptChapters = new Set(after.map((c) => c.publicId));
    const keptTopics = new Set(after.flatMap((c) => c.topics.map((t) => t.publicId)));
    const removedChapters = before.filter((c) => !keptChapters.has(c.publicId));
    const removedTopics = before
      .filter((c) => keptChapters.has(c.publicId))
      .flatMap((c) => c.topics)
      .filter((t) => !keptTopics.has(t.publicId));
    if (removedChapters.length === 0 && removedTopics.length === 0) return;

    const courses = await CourseModel.find(
      { curriculumPublicId, status: { $in: ACTIVE_COURSE_STATUSES }, isDeleted: false },
      { topicPublicIds: 1, pickedTopicPublicIds: 1 },
    ).lean();
    const usedChapters = new Set(courses.flatMap((c) => c.topicPublicIds ?? []));
    const usedTopics = new Set(courses.flatMap((c) => c.pickedTopicPublicIds ?? []));

    const materialFilter = { curriculumPublicId, isDeleted: false, topicPublicIds: { $in: removedChapters.map((c) => c.publicId) } };
    const materials = removedChapters.length === 0 ? 0 : (await Promise.all([
      ResourceModel.countDocuments(materialFilter),
      AssignmentModel.countDocuments(materialFilter),
      WorksheetModel.countDocuments(materialFilter),
    ])).reduce((a, b) => a + b, 0);

    const blockedChapters = removedChapters.filter((c) => usedChapters.has(c.publicId));
    const blockedTopics = removedTopics.filter((t) => usedTopics.has(t.publicId));
    const quote = (xs: Array<{ title: string }>) => xs.map((x) => `"${x.title}"`).join(', ');
    if (blockedChapters.length > 0) {
      throw new ConflictError(`Cannot remove chapter ${quote(blockedChapters)}: it is part of an active course`);
    }
    if (blockedTopics.length > 0) {
      throw new ConflictError(`Cannot remove topic ${quote(blockedTopics)}: it is part of an active course`);
    }
    if (materials > 0) {
      throw new ConflictError('Cannot remove a chapter that has resources, assignments or worksheets attached; delete those first');
    }
  }

  async setPublished(curriculumPublicId: string, isPublished: boolean): Promise<ICurriculum> {
    const updated = await CurriculumModel.findOneAndUpdate(
      { publicId: curriculumPublicId, isDeleted: false },
      { $set: { isPublished } },
      { new: true },
    ).lean();
    if (!updated) throw new NotFoundError('Curriculum');
    return updated;
  }

  /** Publishes every draft curriculum of one state. Already published and deleted ones are untouched. */
  async publishAllForState(stateCode: string): Promise<{ published: number }> {
    const result = await CurriculumModel.updateMany(
      { stateCode, isDeleted: false, isPublished: false },
      { $set: { isPublished: true } },
    );
    return { published: result.modifiedCount };
  }

  /** Soft delete. Refused while students hold PENDING or ACCEPTED (prepaid) requests —
   *  admins can unpublish instead. Finished requests keep resolving the curriculum title. */
  async softDelete(curriculumPublicId: string): Promise<void> {
    const curriculum = await CurriculumModel.findOne({ publicId: curriculumPublicId, isDeleted: false }).lean();
    if (!curriculum) throw new NotFoundError('Curriculum');
    const active = await CourseModel.countDocuments({
      curriculumPublicId,
      status: { $in: ACTIVE_COURSE_STATUSES },
      isDeleted: false,
    });
    if (active > 0) {
      throw new ConflictError(`Curriculum has ${active} active request${active === 1 ? '' : 's'} — unpublish it instead`);
    }
    await CurriculumModel.updateOne(
      { publicId: curriculumPublicId, isDeleted: false },
      { $set: { isDeleted: true, isPublished: false } },
    );
  }

  /** `forStudent` strips admin-only import metadata. */
  async getByPublicId(curriculumPublicId: string, opts: { forStudent?: boolean } = {}): Promise<ICurriculum> {
    const curriculum = await CurriculumModel.findOne(
      { publicId: curriculumPublicId, isDeleted: false },
      opts.forStudent ? STUDENT_HIDDEN_FIELDS : undefined,
    ).lean();
    if (!curriculum) throw new NotFoundError('Curriculum');
    return curriculum;
  }

  /** State-based catalog: every published curriculum for a state (publishing is what makes one visible).
   *  High school is organised by course, not grade: Grade 9-12 students get the 'High School' curricula. */
  async listByState(filters: { stateCode: string; grade?: string; subject?: string }): Promise<{ curricula: ICurriculum[]; stateLoaded: boolean }> {
    const filter: Record<string, unknown> = { stateCode: filters.stateCode, isPublished: true, isDeleted: false };
    if (filters.subject) filter.subject = filters.subject;
    if (filters.grade) filter.grade = HIGH_SCHOOL_GRADES.has(filters.grade) ? HIGH_SCHOOL_GRADE : filters.grade;
    const curricula = await CurriculumModel.find(filter, STUDENT_HIDDEN_FIELDS).sort({ title: 1 }).limit(2000).lean();
    curricula.sort((a, b) => gradeRank(a.grade) - gradeRank(b.grade) || a.title.localeCompare(b.title));
    const stateLoaded = curricula.length > 0
      || !!(await CurriculumModel.exists({ stateCode: filters.stateCode, isPublished: true, isDeleted: false }));
    return { curricula, stateLoaded };
  }

  /** States that have curricula, with how many are published (admin state picker). */
  async listAdminStates(): Promise<AdminStateSummary[]> {
    const rows = await CurriculumModel.aggregate<{ _id: string; total: number; published: number }>([
      { $match: { isDeleted: false, stateCode: { $exists: true, $ne: null } } },
      { $group: { _id: '$stateCode', total: { $sum: 1 }, published: { $sum: { $cond: ['$isPublished', 1, 0] } } } },
    ]);
    return rows.map((r) => ({ stateCode: r._id, total: r.total, published: r.published }));
  }

  /** Every curriculum of one state in a light form, for the admin grade → subject view. */
  async listAdminOverview(stateCode: string): Promise<AdminCurriculumSummary[]> {
    const docs = await CurriculumModel.find(
      { stateCode, isDeleted: false },
      { publicId: 1, title: 1, subject: 1, grade: 1, level: 1, courseName: 1, usualGrade: 1, isPublished: 1, 'chapters.topics.publicId': 1, 'chapters.publicId': 1 },
    ).lean();
    return docs
      .map((d) => ({
        publicId: d.publicId,
        title: d.title,
        subject: d.subject,
        grade: d.grade,
        level: d.level,
        courseName: d.courseName,
        usualGrade: d.usualGrade,
        isPublished: d.isPublished,
        chapterCount: d.chapters?.length ?? 0,
        topicCount: (d.chapters ?? []).reduce((n, c) => n + (c.topics?.length ?? 0), 0),
      }))
      .sort((a, b) => gradeRank(a.grade) - gradeRank(b.grade) || a.subject.localeCompare(b.subject) || a.title.localeCompare(b.title));
  }
}

/** Keeps existing ids when the client omits them: an id-less input takes the id of the existing item at the
 *  same position if titles match, else the first unclaimed existing item with the same title. Truly new
 *  items get a fresh id. Works for chapters and for topics. */
function keepIds<T extends { publicId: string; title: string; order?: number }, I extends { publicId?: string; title: string; order?: number }>(
  existing: T[],
  input: I[],
): Array<{ input: I; publicId: string; order: number; previous?: T }> {
  const claimed = new Set(input.map((t) => t.publicId).filter((id): id is string => !!id));
  const sorted = [...existing].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return input.map((t, i) => {
    let publicId = t.publicId;
    if (!publicId) {
      const atPos = sorted[i];
      const match = atPos && !claimed.has(atPos.publicId) && atPos.title === t.title
        ? atPos
        : sorted.find((e) => !claimed.has(e.publicId) && e.title === t.title);
      if (match) { publicId = match.publicId; claimed.add(publicId); }
    }
    publicId = publicId ?? uuidv4();
    return { input: t, publicId, order: i, previous: existing.find((e) => e.publicId === publicId) };
  });
}

export function mergeChapters(existing: ICurriculumChapter[], input: CurriculumChapterInput[]): ICurriculumChapter[] {
  return keepIds(existing, input).map(({ input: ch, publicId, order, previous }) => ({
    publicId,
    title: ch.title,
    order,
    topics: keepIds(previous?.topics ?? [], ch.topics ?? []).map((t) => ({ publicId: t.publicId, title: t.input.title, order: t.order })),
  }));
}

const HIGH_SCHOOL_GRADES = new Set<string>(['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12']);
const GRADE_RANK = new Map<string, number>(GRADE_LIST.map((g, i) => [g, i]));
/** 'High School' sorts after every grade; unknown strings after that. */
export function gradeRank(grade: string): number {
  if (grade === HIGH_SCHOOL_GRADE) return GRADE_LIST.length;
  return GRADE_RANK.get(grade) ?? GRADE_LIST.length + 1;
}

export const curriculumService = new CurriculumService();
