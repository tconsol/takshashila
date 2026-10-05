import { ScheduledClassModel } from '../modules/schedules/schedule.model';
import { TutorProfileModel } from '../modules/tutors/tutor.model';
import { StudentProfileModel } from '../modules/students/student.model';
import { ParentProfileModel } from '../modules/parents/parent.model';

/** 'tutor' / 'student' are participants; 'observer' may watch but must not relay. */
export type ClassMembership = 'tutor' | 'student' | 'observer' | null;

/**
 * The key of the live room a class uses. The records of one group session share a
 * `groupPublicId` and therefore one room; any other class uses its own id.
 */
export async function getClassRoomKey(classPublicId: string): Promise<string> {
  const cls = await ScheduledClassModel.findOne(
    { publicId: classPublicId, isDeleted: false },
    { groupPublicId: 1 },
  ).lean();
  return cls?.groupPublicId ?? classPublicId;
}

/**
 * Non-throwing sibling of `assertClassParty` (modules/classes/class-access.ts) for the
 * socket layer. Tutor and student are active participants; the tutor's principal,
 * the student's parent and admins are watch-only observers. Anyone else gets null.
 */
export async function getClassMembership(
  actor: { publicId: string; role: string },
  classPublicId: string,
): Promise<ClassMembership> {
  if (typeof classPublicId !== 'string' || !classPublicId) return null;
  const cls = await ScheduledClassModel.findOne(
    { publicId: classPublicId, isDeleted: false },
    { tutorPublicId: 1, studentPublicId: 1 },
  ).lean();
  if (!cls) return null;

  if (actor.role === 'ADMIN' || actor.role === 'SUPER_ADMIN') return 'observer';

  const ownTutor = await TutorProfileModel.findOne(
    { userPublicId: actor.publicId, isDeleted: false },
    { publicId: 1 },
  ).lean();
  if (ownTutor?.publicId === cls.tutorPublicId) return 'tutor';

  // A student has one profile per tutor link: look up the class's own profile, not the first one.
  const student = await StudentProfileModel.findOne(
    { userPublicId: actor.publicId, publicId: cls.studentPublicId, isDeleted: false },
    { publicId: 1 },
  ).lean();
  if (student?.publicId === cls.studentPublicId) return 'student';

  if (actor.role === 'PRINCIPAL') {
    const classTutor = await TutorProfileModel.findOne(
      { publicId: cls.tutorPublicId, isDeleted: false },
      { principalPublicId: 1 },
    ).lean();
    if (classTutor?.principalPublicId === actor.publicId) return 'observer';
  }

  if (actor.role === 'PARENT') {
    const parent = await ParentProfileModel.findOne(
      { userPublicId: actor.publicId },
      { childStudentPublicIds: 1 },
    ).lean();
    if (parent?.childStudentPublicIds?.includes(cls.studentPublicId)) return 'observer';
  }

  return null;
}
