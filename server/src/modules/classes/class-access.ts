import { ScheduledClassModel } from '../schedules/schedule.model';
import { TutorProfileModel } from '../tutors/tutor.model';
import { StudentProfileModel } from '../students/student.model';
import { ParentProfileModel } from '../parents/parent.model';
import { NotFoundError } from '../../utils/error';

export interface ClassActor {
  publicId: string;
  role: string;
}

/**
 * Only people who belong to a class may act on it: its tutor, its student
 * (when allowed), the principal who runs that tutor's organization, or an admin.
 * Everyone else gets a 404, so class IDs can't be probed.
 */
export async function assertClassParty(
  actor: ClassActor,
  classPublicId: string,
  opts: { allowStudent: boolean },
): Promise<void> {
  if (actor.role === 'ADMIN' || actor.role === 'SUPER_ADMIN') return;

  const cls = await ScheduledClassModel.findOne(
    { publicId: classPublicId, isDeleted: false },
    { tutorPublicId: 1, studentPublicId: 1 },
  ).lean();

  if (cls) {
    const ownTutor = await TutorProfileModel.findOne(
      { userPublicId: actor.publicId, isDeleted: false },
      { publicId: 1 },
    ).lean();
    if (ownTutor?.publicId === cls.tutorPublicId) return;

    if (actor.role === 'PRINCIPAL') {
      const classTutor = await TutorProfileModel.findOne(
        { publicId: cls.tutorPublicId, isDeleted: false },
        { principalPublicId: 1 },
      ).lean();
      if (classTutor?.principalPublicId === actor.publicId) return;
    }

    if (opts.allowStudent) {
      const student = await StudentProfileModel.findOne(
        { userPublicId: actor.publicId, isDeleted: false },
        { publicId: 1 },
      ).lean();
      if (student?.publicId === cls.studentPublicId) return;
    }
  }
  throw new NotFoundError('Scheduled class');
}

/**
 * Who may READ a class (or join it to watch): its tutor and student, a parent
 * of that student, the principal of the tutor's organization, or an admin.
 * Anyone else gets a 404 so class IDs cannot be probed for cost, people or
 * meeting links.
 */
export async function assertClassViewer(actor: ClassActor, classPublicId: string): Promise<void> {
  try {
    await assertClassParty(actor, classPublicId, { allowStudent: true });
    return;
  } catch (error) {
    if (!(error instanceof NotFoundError)) throw error;
  }

  if (actor.role === 'PARENT') {
    const cls = await ScheduledClassModel.findOne(
      { publicId: classPublicId, isDeleted: false },
      { studentPublicId: 1 },
    ).lean();
    if (cls?.studentPublicId) {
      const parent = await ParentProfileModel.findOne(
        { userPublicId: actor.publicId, isDeleted: false },
        { childStudentPublicIds: 1 },
      ).lean();
      if (parent?.childStudentPublicIds?.includes(cls.studentPublicId)) return;
    }
  }
  throw new NotFoundError('Scheduled class');
}
