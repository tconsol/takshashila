// server/src/modules/courses/material-access.ts
//
// Who may see / open a curriculum-attached material (curriculum-materials spec §4).
// Legacy items without a curriculum are not gated here — their existing rules apply.
import { CourseModel } from './course.model';
import { CourseStatus } from './course.types';
import { TutorProfileModel } from '../tutors/tutor.model';
import { StudentProfileModel } from '../students/student.model';
import { ParentProfileModel } from '../parents/parent.model';
import type { CurriculumAttachment } from '../../shared/material.types';

export type Viewer = { role: string; userPublicId: string };
export interface MaterialLike extends CurriculumAttachment { tutorPublicId?: string }

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
    const p = await ParentProfileModel.findOne({ userPublicId: viewer.userPublicId }).lean();
    return p?.childStudentPublicIds ?? [];
  }
  return [];
}

export async function canViewMaterial(viewer: Viewer, m: MaterialLike): Promise<boolean> {
  if (!m.curriculumPublicId) return true;
  if (viewer.role === 'ADMIN' || viewer.role === 'SUPER_ADMIN') return true;

  // Principals teach through an auto-created tutor profile.
  if (viewer.role === 'TUTOR' || viewer.role === 'PRINCIPAL') {
    const tutor = await TutorProfileModel.findOne({ userPublicId: viewer.userPublicId, isDeleted: false }).lean();
    if (!tutor) return false;
    if (m.authorRole !== 'ADMIN') return m.tutorPublicId === tutor.publicId;
    return !!(await CourseModel.exists({ tutorPublicId: tutor.publicId, ...courseScope(m) }));
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
 * Extra filter for a student's generic Homework/Resources lists: legacy items as before,
 * plus tutor-authored curriculum items only where the student has an active course with
 * that tutor on that curriculum sharing a topic. Admin items are reached via the course
 * structure only.
 */
export async function studentMaterialScope(studentPublicId: string): Promise<Record<string, unknown>> {
  const courses = await CourseModel.find(
    { studentPublicId, status: { $in: ACTIVE_COURSE_STATUSES }, isDeleted: false },
    { curriculumPublicId: 1, tutorPublicId: 1, topicPublicIds: 1 },
  ).lean();
  return {
    $or: [
      { curriculumPublicId: { $exists: false } },
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
  const course = await CourseModel.findOne({ studentPublicId, ...courseScope(m) }).sort({ updatedAt: -1 }).lean();
  return course?.tutorPublicId;
}
