/* The records of one group session share one live room (one groupPublicId). */
import { classService } from '../../modules/classes/class.service';
import { classController } from '../../modules/classes/class.controller';
import { ScheduledClassModel } from '../../modules/schedules/schedule.model';
import { StudentProfileModel } from '../../modules/students/student.model';
import { TutorProfileModel } from '../../modules/tutors/tutor.model';
import { getClassRoomKey } from '../../sockets/class-membership';
import { tutorService } from '../../modules/tutors/tutor.service';
import { walletService } from '../../modules/wallets/wallet.service';
import { settingsService } from '../../modules/settings/settings.service';
import { domainEvents } from '../../events/event-emitter';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });
const HOUR = 3_600_000;
const iso = (ms: number) => new Date(Date.now() + ms).toISOString();
const base = (over: object = {}) => ({
  title: 'T', classType: 'GROUP', recurrence: 'NONE', studentPublicIds: ['s1', 's2'],
  startUTC: iso(24 * HOUR), endUTC: iso(25 * HOUR), ...over,
}) as never;

describe('group session shares one room', () => {
  beforeEach(() => jest.restoreAllMocks());

  describe('tutorCreateClasses', () => {
    let create: jest.SpyInstance;
    beforeEach(() => {
      jest.spyOn(tutorService, 'getByUserPublicId').mockResolvedValue({ publicId: 'tp1', userPublicId: 'tu1' } as never);
      jest.spyOn(StudentProfileModel, 'find').mockReturnValue(lean([
        { publicId: 's1', userPublicId: 'su1' }, { publicId: 's2', userPublicId: 'su2' },
      ]) as never);
      jest.spyOn(settingsService, 'get').mockResolvedValue({ maxAdvanceBookingDays: 30, minClassDurationMinutes: 30, maxClassDurationMinutes: 180 } as never);
      jest.spyOn(walletService, 'getWallet').mockResolvedValue({ balanceCents: 1_000_000 } as never);
      jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(null) as never);
      create = jest.spyOn(ScheduledClassModel, 'create').mockImplementation((async (d: object) => ({ toObject: () => d })) as never);
      jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);
    });

    it('gives every student of one session the same groupPublicId', async () => {
      await classService.tutorCreateClasses('tu1', base());
      const ids = create.mock.calls.map(([d]) => d.groupPublicId);
      expect(ids).toHaveLength(2);
      expect(ids[0]).toBeTruthy();
      expect(ids[0]).toBe(ids[1]);
    });

    it('gives a repeating group a different group per session', async () => {
      const day = 24 * HOUR;
      await classService.tutorCreateClasses('tu1', base({
        recurrence: 'DAILY', recurrenceEndDate: iso(day + day + HOUR), startUTC: iso(day), endUTC: iso(day + HOUR),
      }));
      const ids = [...new Set(create.mock.calls.map(([d]) => d.groupPublicId))];
      expect(ids.length).toBeGreaterThan(1);
    });

    it('does not group a class with a single student', async () => {
      await classService.tutorCreateClasses('tu1', base({ studentPublicIds: ['s1'] }));
      expect(create.mock.calls[0][0].groupPublicId).toBeUndefined();
    });
  });

  describe('tutor joining', () => {
    const mockJoin = (cls: object) => {
      jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(cls) as never);
      jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'tp1', userPublicId: 'tu1' }) as never);
      jest.spyOn(StudentProfileModel, 'findOne').mockReturnValue(lean({ userPublicId: 'su1' }) as never);
      jest.spyOn(ScheduledClassModel, 'findOneAndUpdate').mockReturnValue(lean({ ...cls, status: 'LIVE' }) as never);
      jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);
      return jest.spyOn(ScheduledClassModel, 'updateMany').mockResolvedValue({} as never);
    };

    it('marks the other students records joined by the tutor and LIVE', async () => {
      const updateMany = mockJoin({ publicId: 'c1', tutorPublicId: 'tp1', studentPublicId: 's1', status: 'SCHEDULED', groupPublicId: 'g1', isDeleted: false });

      await classService.joinClass('c1', 'tu1', 'TUTOR');

      const filters = updateMany.mock.calls.map(([f]) => f as Record<string, unknown>);
      expect(filters).toHaveLength(2);
      expect(filters.every((f) => f.groupPublicId === 'g1' && JSON.stringify(f.publicId) === JSON.stringify({ $ne: 'c1' }))).toBe(true);
      expect(updateMany.mock.calls[0][1]).toMatchObject({ $set: { tutorJoinedAt: expect.any(Date) } });
      expect(updateMany.mock.calls[1][1]).toMatchObject({ $set: { status: 'LIVE' } });
    });

    it('does not touch other records for a single class', async () => {
      const updateMany = mockJoin({ publicId: 'c1', tutorPublicId: 'tp1', studentPublicId: 's1', status: 'SCHEDULED', isDeleted: false });
      await classService.joinClass('c1', 'tu1', 'TUTOR');
      expect(updateMany).not.toHaveBeenCalled();
    });
  });

  describe('room key', () => {
    it('is the group id for a grouped class', async () => {
      jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean({ groupPublicId: 'g1' }) as never);
      await expect(getClassRoomKey('c1')).resolves.toBe('g1');
    });
    it('is the class id for a single class', async () => {
      jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean({}) as never);
      await expect(getClassRoomKey('c1')).resolves.toBe('c1');
    });
  });

  describe('video token channel', () => {
    it('uses the group id so every student meets in the same channel', async () => {
      jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean({ publicId: 'c1', status: 'LIVE', tutorPublicId: 'tp1', groupPublicId: 'g1' }) as never);
      jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'tp1' }) as never);
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
      await classController.getAgoraToken({ user: { publicId: 'tu1', role: 'TUTOR' }, params: { classId: 'c1' } } as never, res as never, jest.fn());
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ channel: 'g1' }) }));
    });
  });
});
