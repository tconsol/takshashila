import { ScheduledClassModel } from '../schedules/schedule.model';
import { ClassStatus } from '../schedules/schedule.types';
import type { IScheduledClass } from '../schedules/schedule.types';
import { TutorProfileModel } from '../tutors/tutor.model';
import { StudentProfileModel } from '../students/student.model';
import { settingsService } from '../settings/settings.service';
import { NotFoundError } from '../../utils/error';
import { ClassPresenceModel } from './class-presence.model';
import { applyHeartbeat, attendedMs, requiredAttendanceMinutes } from './class-presence';
import type { PresenceInterval } from './class-presence';

const MAX_WRITE_ATTEMPTS = 3;

export class ClassPresenceService {
  /** Room (and presence) key: a group session shares one, a single class uses its own id. */
  roomKey(cls: Pick<IScheduledClass, 'publicId' | 'groupPublicId'>): string {
    return cls.groupPublicId ?? cls.publicId;
  }

  /**
   * Which side of the class this user is. Only the class's own tutor and its own
   * student are tracked: principals, parents and admins who watch are not attending.
   * Anyone else gets a 404, same as the other class endpoints.
   */
  private async roleInClass(
    cls: Pick<IScheduledClass, 'tutorPublicId' | 'studentPublicId'>,
    userPublicId: string,
  ): Promise<'TUTOR' | 'STUDENT'> {
    const tutor = await TutorProfileModel.findOne({ userPublicId, isDeleted: false }, { publicId: 1 }).lean();
    if (tutor?.publicId === cls.tutorPublicId) return 'TUTOR';
    // A student has one profile per tutor link: match the class's own profile.
    const student = await StudentProfileModel.findOne(
      { userPublicId, publicId: cls.studentPublicId, isDeleted: false },
      { publicId: 1 },
    ).lean();
    if (student?.publicId === cls.studentPublicId) return 'STUDENT';
    throw new NotFoundError('Scheduled class');
  }

  /**
   * Called by the room page every 30 seconds, and once more when the person leaves.
   * Time is the server's clock, never the client's. Closed classes are ignored.
   */
  async recordPresence(classPublicId: string, userPublicId: string, now: Date = new Date()): Promise<void> {
    const cls = await ScheduledClassModel.findOne(
      { publicId: classPublicId, isDeleted: false },
      { publicId: 1, groupPublicId: 1, tutorPublicId: 1, studentPublicId: 1, status: 1 },
    ).lean();
    if (!cls) throw new NotFoundError('Scheduled class');
    const role = await this.roleInClass(cls, userPublicId);
    if (cls.status !== ClassStatus.SCHEDULED && cls.status !== ClassStatus.LIVE) return;

    const graceMs = (await settingsService.get()).disconnectGraceMinutes * 60_000;
    const filter = { roomKey: this.roomKey(cls), userPublicId };

    // Compare-and-set on lastSeenAt: two tabs of one person must not overwrite each other.
    for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt++) {
      const current = await ClassPresenceModel.findOne(filter).lean();
      if (!current) {
        try {
          await ClassPresenceModel.create({
            ...filter, role, intervals: applyHeartbeat([], now, graceMs), lastSeenAt: now,
          });
          return;
        } catch (err) {
          if ((err as { code?: number }).code === 11000) continue; // the other tab created it first
          throw err;
        }
      }
      const intervals = applyHeartbeat(current.intervals, now, graceMs);
      const lastSeenAt = new Date(Math.max(current.lastSeenAt.getTime(), now.getTime()));
      const res = await ClassPresenceModel.updateOne(
        { ...filter, lastSeenAt: current.lastSeenAt },
        { $set: { intervals, lastSeenAt } },
      );
      if (res.modifiedCount === 1) return;
    }
  }

  /** Minutes of the scheduled window this person was present, from stored presence. */
  async attendedMinutes(
    cls: Pick<IScheduledClass, 'publicId' | 'groupPublicId' | 'startUTC' | 'endUTC'>,
    userPublicId: string,
  ): Promise<number> {
    const doc = await ClassPresenceModel.findOne({ roomKey: this.roomKey(cls), userPublicId }).lean();
    if (!doc) return 0;
    return attendedMs(doc.intervals as PresenceInterval[], cls.startUTC, cls.endUTC) / 60_000;
  }

  /** Whether any presence was recorded for the room; classes without it use the old rule. */
  async hasPresenceData(cls: Pick<IScheduledClass, 'publicId' | 'groupPublicId'>): Promise<boolean> {
    return (await ClassPresenceModel.exists({ roomKey: this.roomKey(cls) })) !== null;
  }

  /** The attendance the class needs from each person, per the admin setting. */
  async requiredMinutes(cls: Pick<IScheduledClass, 'durationMinutes'>): Promise<number> {
    const { minAttendancePercent } = await settingsService.get();
    return requiredAttendanceMinutes(cls.durationMinutes, minAttendancePercent);
  }
}

export const classPresenceService = new ClassPresenceService();
