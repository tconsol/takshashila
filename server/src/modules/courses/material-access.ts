// server/src/modules/courses/material-access.ts
//
// Who may see / open a material (curriculum-materials spec §4), plus the rules for
// older, non-curriculum ("legacy") items: tutors see their own, students see items from
// their tutors (profile tutor or any tutor they have a class with), parents follow children.
import { CourseModel } from './course.model';
import { CourseStatus } from './course.types';
import { TutorProfileModel } from '../tutors/tutor.model';
import { StudentProfileModel } from '../students/student.model';
import { ParentProfileModel } from '../parents/parent.model';
import { ScheduledClassModel } from '../schedules/schedule.model';
import type { CurriculumAttachment } from '../../shared/material.types';

export type Viewer = { role: string; userPublicId: string };
export interface MaterialLike extends CurriculumAttachment {
  tutorPublicId?: string;
  classPublicId?: string;
  assignedToStudentPublicIds?: string[];
}
export type MaterialKind = 'resource' | 'assignment' | 'worksheet';

const isAdmin = (v: Viewer) => v.role === 'ADMIN' || v.role === 'SUPER_ADMIN';
// Principals teach through an auto-created tutor profile.
const isTeacher = (v: Viewer) => v.role === 'TUTOR' || v.role === 'PRINCIPAL';

async function tutorProfileId(viewer: Viewer): Promise<string | undefined> {
  const tutor = await TutorProfileModel.findOne({ userPublicId: viewer.userPublicId, isDeleted: false }).lean();
  return tutor?.publicId;
}

/** A student's tutors: the tutor on their profile plus any tutor they have a class with. */
export async function tutorIdsForStudents(studentIds: string[]): Promise<string[]> {
  const [profiles, classTutors] = await Promise.all([
    StudentProfileModel.find({ publicId: { $in: studentIds }, isDeleted: false }, { publicId: 1, tutorPublicId: 1 }).lean(),
    ScheduledClassModel.distinct('tutorPublicId', { studentPublicId: { $in: studentIds }, isDeleted: false }),
  ]);
  return [...new Set([
    ...profiles.flatMap((p) => (p.tutorPublicId ? [p.tutorPublicId] : [])),
    ...(classTutors as string[]),
  ])];
}

export const ACTIVE_COURSE_STATUSES = [CourseStatus.ACCEPTED, CourseStatus.COMPLETED];

const courseScope = (m: MaterialLike) => ({
  curriculumPublicId: m.curriculumPublicId,
  topicPublicIds: { $in: m.topicPublicIds ?? [] },
  status: { $in: ACTIVE_COURSE_STATUSES },
  isDeleted: false,
});

async function studentIdsFor(viewer: Viewer): Promise<string[]> {
  if (viewer.role === 'STUDENT') {
    const s = await StudentProfileModel.findOne({ userPublicId: viewer.userPublicId, isDeleted: false }).lean();
    return s ? [s.publicId] : [];
  }
  if (viewer.role === 'PARENT') {
    const p = await ParentProfileModel.findOne({ userPublicId: viewer.userPublicId, isDeleted: false }).lean();
    return p?.childStudentPublicIds ?? [];
  }
  return [];
}

async function canViewLegacy(viewer: Viewer, m: MaterialLike, kind?: MaterialKind): Promise<boolean> {
  if (isTeacher(viewer)) return !!m.tutorPublicId && (await tutorProfileId(viewer)) === m.tutorPublicId;
  if (viewer.role !== 'STUDENT' && viewer.role !== 'PARENT') return false;
  const studentIds = await studentIdsFor(viewer);
  if (studentIds.length === 0) return false;

  // Worksheets addressed to specific students go to those students only.
  if (kind === 'worksheet' && m.assignedToStudentPublicIds?.length) {
    return m.assignedToStudentPublicIds.some((id) => studentIds.includes(id));
  }
  // Class-bound items (assignments, class resources) go to that class's student.
  if (kind !== 'worksheet' && m.classPublicId) {
    return !!(await ScheduledClassModel.exists({ publicId: m.classPublicId, studentPublicId: { $in: studentIds } }));
  }
  return !!m.tutorPublicId && (await tutorIdsForStudents(studentIds)).includes(m.tutorPublicId);
}

export async function canViewMaterial(viewer: Viewer, m: MaterialLike, kind?: MaterialKind): Promise<boolean> {
  if (isAdmin(viewer)) return true;
  if (!m.curriculumPublicId) return canViewLegacy(viewer, m, kind);

  if (isTeacher(viewer)) {
    const tutorId = await tutorProfileId(viewer);
    if (!tutorId) return false;
    if (m.authorRole !== 'ADMIN') return m.tutorPublicId === tutorId;
    return !!(await CourseModel.exists({ tutorPublicId: tutorId, ...courseScope(m) }));
  }

  if (viewer.role === 'STUDENT' || viewer.role === 'PARENT') {
    const studentIds = await studentIdsFor(viewer);
    if (studentIds.length === 0) return false;
    const filter: Record<string, unknown> = { studentPublicId: { $in: studentIds }, ...courseScope(m) };
    if (m.authorRole !== 'ADMIN') filter.tutorPublicId = m.tutorPublicId;
    return !!(await CourseModel.exists(filter));
  }

  return false;
}

/**
 * Extra filter for a student's Homework/Resources lists: legacy items from the student's
 * tutors (worksheets also when addressed to the student), plus tutor-authored curriculum
 * items only where the student has an active course with that tutor on that curriculum
 * sharing a topic. Admin items are reached via the course structure only.
 */
export async function studentMaterialScope(studentPublicId: string, kind: 'worksheet' | 'resource'): Promise<Record<string, unknown>> {
  const [courses, tutorIds] = await Promise.all([
    CourseModel.find(
      { studentPublicId, status: { $in: ACTIVE_COURSE_STATUSES }, isDeleted: false },
      { curriculumPublicId: 1, tutorPublicId: 1, topicPublicIds: 1 },
    ).lean(),
    tutorIdsForStudents([studentPublicId]),
  ]);
  const legacy = { curriculumPublicId: { $exists: false } };
  return {
    $or: [
      ...(kind === 'worksheet' ? [{ ...legacy, assignedToStudentPublicIds: studentPublicId }] : []),
      { ...legacy, tutorPublicId: { $in: tutorIds } },
      ...courses.map((c) => ({
        curriculumPublicId: c.curriculumPublicId,
        tutorPublicId: c.tutorPublicId,
        topicPublicIds: { $in: c.topicPublicIds },
        authorRole: { $ne: 'ADMIN' },
      })),
    ],
  };
}

/** Mongo filter for the materials a course's structure shows. */
export function materialFilterForCourse(course: { curriculumPublicId: string; topicPublicIds: string[]; tutorPublicId: string }) {
  return {
    curriculumPublicId: course.curriculumPublicId,
    topicPublicIds: { $in: course.topicPublicIds },
    isDeleted: false,
    $or: [{ authorRole: 'ADMIN' }, { tutorPublicId: course.tutorPublicId }],
  };
}

/** Tutor who handles a student's submission for an admin-authored item. */
export async function findGraderTutor(studentPublicId: string, m: MaterialLike): Promise<string | undefined> {
  // Acceptance time, not updatedAt: updatedAt moves on every class completion.
  const course = await CourseModel.findOne({ studentPublicId, ...courseScope(m) }).sort({ acceptedAt: -1, createdAt: -1 }).lean();
  return course?.tutorPublicId;
}

/** Who may list a class's items: its student (and their parents), its tutor, admins. */
export async function canViewClass(viewer: Viewer, classPublicId: string): Promise<boolean> {
  if (isAdmin(viewer)) return true;
  const cls = await ScheduledClassModel.findOne({ publicId: classPublicId, isDeleted: false }, { studentPublicId: 1, tutorPublicId: 1 }).lean();
  if (!cls) return false;
  if (isTeacher(viewer)) return (await tutorProfileId(viewer)) === cls.tutorPublicId;
  return (await studentIdsFor(viewer)).includes(cls.studentPublicId);
}
