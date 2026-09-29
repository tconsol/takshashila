/* tutorReschedule guards: past times, tutor overlap, status-guarded write,
   and detaching/releasing the original availability slot. */
import { classService } from '../../modules/classes/class.service';
import { ScheduledClassModel } from '../../modules/schedules/schedule.model';
import { StudentProfileModel } from '../../modules/students/student.model';
import { ClassStatus } from '../../modules/schedules/schedule.types';
import { tutorService } from '../../modules/tutors/tutor.service';
import { scheduleService } from '../../modules/schedules/schedule.service';
import { domainEvents } from '../../events/event-emitter';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });
const HOUR = 3_600_000;
const iso = (ms: number) => new Date(Date.now() + ms).toISOString();

const cls = {
  publicId: 'class-1',
  tutorPublicId: 'tutor-prof-1',
  studentPublicId: 'student-prof-1',
  status: ClassStatus.SCHEDULED,
  availabilitySlotPublicId: 'slot-1',
};

describe('ClassService.tutorReschedule', () => {
  let findOne: jest.SpyInstance;
  let update: jest.SpyInstance;
  let release: jest.SpyInstance;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(tutorService, 'getByUserPublicId').mockResolvedValue({ publicId: 'tutor-prof-1' } as never);
    // 1st findOne = the class, 2nd = overlap lookup (default: none)
    findOne = jest.spyOn(ScheduledClassModel, 'findOne')
      .mockReturnValueOnce(lean(cls) as never)
      .mockReturnValue(lean(null) as never);
    update = jest.spyOn(ScheduledClassModel, 'findOneAndUpdate').mockReturnValue(lean({ ...cls }) as never);
    jest.spyOn(StudentProfileModel, 'findOne').mockReturnValue(lean({ userPublicId: 's' }) as never);
    release = jest.spyOn(scheduleService, 'releaseSlot').mockResolvedValue(undefined as never);
    jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);
  });

  it('rejects a start time in the past', async () => {
    await expect(
      classService.tutorReschedule('class-1', 'u', { startUTC: iso(-2 * HOUR), endUTC: iso(-HOUR) }),
    ).rejects.toThrow(/past/);
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects end <= start', async () => {
    await expect(
      classService.tutorReschedule('class-1', 'u', { startUTC: iso(2 * HOUR), endUTC: iso(HOUR) }),
    ).rejects.toThrow(/after start/);
  });

  it('rejects an overlap with another of the tutor\'s classes', async () => {
    findOne.mockReset()
      .mockReturnValueOnce(lean(cls) as never)
      .mockReturnValue(lean({ publicId: 'other' }) as never);
    await expect(
      classService.tutorReschedule('class-1', 'u', { startUTC: iso(HOUR), endUTC: iso(2 * HOUR) }),
    ).rejects.toThrow(/already have a class/);
    expect(update).not.toHaveBeenCalled();
  });

  it('throws a conflict when the status-guarded write matches nothing', async () => {
    update.mockReturnValue(lean(null) as never);
    await expect(
      classService.tutorReschedule('class-1', 'u', { startUTC: iso(HOUR), endUTC: iso(2 * HOUR) }),
    ).rejects.toThrow(/no longer reschedulable/);
    expect(release).not.toHaveBeenCalled();
  });

  it('guards the write by status, unsets the slot link and releases the slot', async () => {
    await classService.tutorReschedule('class-1', 'u', { startUTC: iso(HOUR), endUTC: iso(2 * HOUR) });
    const [filter, upd] = update.mock.calls[0];
    expect(filter.status).toEqual({ $in: [ClassStatus.SCHEDULED, ClassStatus.LIVE] });
    expect(filter.isDeleted).toBe(false);
    expect(upd.$unset).toEqual({ availabilitySlotPublicId: '', reminderSentAt: '' });
    expect(release).toHaveBeenCalledWith('slot-1');
  });
});
