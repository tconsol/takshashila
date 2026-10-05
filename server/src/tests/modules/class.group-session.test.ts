/* Complete / Cancel / Reschedule by the tutor apply to every student's record of a group session. */
jest.mock('../../modules/classes/class-access', () => ({ assertClassParty: jest.fn().mockResolvedValue(undefined), assertClassViewer: jest.fn() }));
import { classService } from '../../modules/classes/class.service';
import { classController } from '../../modules/classes/class.controller';
import { ScheduledClassModel } from '../../modules/schedules/schedule.model';
import { StudentProfileModel } from '../../modules/students/student.model';
import { tutorService } from '../../modules/tutors/tutor.service';
import { domainEvents } from '../../events/event-emitter';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });
const MIN = 60_000;

/** Started 40 minutes ago, 60 minutes long; both people joined 40 minutes ago. */
const open = (id: string, over: object = {}) => ({
  publicId: id, groupPublicId: 'g1', tutorPublicId: 'tp1', studentPublicId: `s-${id}`, status: 'LIVE', isDeleted: false,
  startUTC: new Date(Date.now() - 40 * MIN), endUTC: new Date(Date.now() + 20 * MIN), durationMinutes: 60,
  studentJoinedAt: new Date(Date.now() - 40 * MIN), tutorJoinedAt: new Date(Date.now() - 40 * MIN), ...over,
});

describe('group session actions', () => {
  beforeEach(() => jest.restoreAllMocks());

  describe('completeSession', () => {
    it('completes the clicked record and every open sibling', async () => {
      jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(open('a')) as never);
      jest.spyOn(ScheduledClassModel, 'find').mockReturnValue(lean([open('b'), open('c')]) as never);
      const complete = jest.spyOn(classService, 'completeClass').mockResolvedValue({ publicId: 'a' } as never);

      await classService.completeSession('a', 'tu1');

      expect(complete.mock.calls.map((c) => c[0])).toEqual(['a', 'b', 'c']);
      expect(complete.mock.calls.every((c) => (c[2] as { manual?: boolean }).manual === true)).toBe(true);
    });

    it('completes nothing when a sibling cannot be completed yet', async () => {
      const justJoined = open('b', { studentJoinedAt: new Date(), tutorJoinedAt: new Date() });
      jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(open('a')) as never);
      jest.spyOn(ScheduledClassModel, 'find').mockReturnValue(lean([justJoined]) as never);
      const complete = jest.spyOn(classService, 'completeClass').mockResolvedValue({} as never);

      await expect(classService.completeSession('a', 'tu1')).rejects.toMatchObject({ statusCode: 409 });
      expect(complete).not.toHaveBeenCalled();
    });

    it('still completes the others when one sibling fails afterwards', async () => {
      jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(open('a')) as never);
      jest.spyOn(ScheduledClassModel, 'find').mockReturnValue(lean([open('b'), open('c')]) as never);
      const complete = jest.spyOn(classService, 'completeClass').mockImplementation((async (id: string) => {
        if (id === 'b') throw new Error('boom');
        return { publicId: id };
      }) as never);

      await expect(classService.completeSession('a', 'tu1')).resolves.toMatchObject({ publicId: 'a' });
      expect(complete.mock.calls.map((c) => c[0])).toEqual(['a', 'b', 'c']);
    });

    it('is a plain complete for a class that is not part of a group', async () => {
      jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(open('a', { groupPublicId: undefined })) as never);
      const find = jest.spyOn(ScheduledClassModel, 'find');
      const complete = jest.spyOn(classService, 'completeClass').mockResolvedValue({ publicId: 'a' } as never);
      await classService.completeSession('a', 'tu1');
      expect(find).not.toHaveBeenCalled();
      expect(complete).toHaveBeenCalledTimes(1);
    });
  });

  describe('cancelSession', () => {
    it('cancels the clicked record and every open sibling', async () => {
      jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(open('a')) as never);
      jest.spyOn(ScheduledClassModel, 'find').mockReturnValue(lean([open('b')]) as never);
      const cancel = jest.spyOn(classService, 'cancelClass').mockResolvedValue({ publicId: 'a' } as never);
      await classService.cancelSession('a', 'tu1', { reason: 'x' } as never);
      expect(cancel.mock.calls.map((c) => c[0])).toEqual(['a', 'b']);
    });
  });

  describe('ClassController.cancelClass', () => {
    const res = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });

    it('a tutor cancels the whole session', async () => {
      const session = jest.spyOn(classService, 'cancelSession').mockResolvedValue({} as never);
      const single = jest.spyOn(classService, 'cancelClass').mockResolvedValue({} as never);
      await classController.cancelClass({ user: { publicId: 'tu1', role: 'TUTOR' }, params: { classId: 'a' }, body: { reason: 'x' } } as never, res() as never, jest.fn());
      expect(session).toHaveBeenCalled();
      expect(single).not.toHaveBeenCalled();
    });

    it('a student cancels only their own record', async () => {
      const session = jest.spyOn(classService, 'cancelSession').mockResolvedValue({} as never);
      const single = jest.spyOn(classService, 'cancelClass').mockResolvedValue({} as never);
      await classController.cancelClass({ user: { publicId: 'su1', role: 'STUDENT' }, params: { classId: 'a' }, body: { reason: 'x' } } as never, res() as never, jest.fn());
      expect(single).toHaveBeenCalled();
      expect(session).not.toHaveBeenCalled();
    });
  });

  describe('tutorReschedule', () => {
    it('moves every sibling record to the new time and does not treat them as a clash', async () => {
      const start = new Date(Date.now() + 48 * 60 * MIN);
      const end = new Date(start.getTime() + 60 * MIN);
      const own = open('a', { status: 'SCHEDULED' });
      jest.spyOn(tutorService, 'getByUserPublicId').mockResolvedValue({ publicId: 'tp1' } as never);
      const findOne = jest.spyOn(ScheduledClassModel, 'findOne').mockImplementation(((q: Record<string, unknown>) =>
        lean(q.startUTC ? null : own)) as never);
      jest.spyOn(ScheduledClassModel, 'findOneAndUpdate').mockReturnValue(lean({ ...own, startUTC: start, endUTC: end }) as never);
      jest.spyOn(StudentProfileModel, 'findOne').mockReturnValue(lean({ userPublicId: 'su-a' }) as never);
      jest.spyOn(StudentProfileModel, 'find').mockReturnValue(lean([{ publicId: 's-b', userPublicId: 'su-b' }]) as never);
      jest.spyOn(ScheduledClassModel, 'find').mockImplementation(((q: Record<string, unknown>) =>
        lean((q.publicId as { $in?: string[] }).$in ? [{ publicId: 'b', studentPublicId: 's-b' }] : [open('b', { status: 'SCHEDULED' })])) as never);
      const updateMany = jest.spyOn(ScheduledClassModel, 'updateMany').mockResolvedValue({} as never);
      const emit = jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);

      await classService.tutorReschedule('a', 'tu1', { startUTC: start.toISOString(), endUTC: end.toISOString() });

      const overlapQuery = findOne.mock.calls.map(([q]) => q as Record<string, unknown>).find((q) => q.startUTC);
      expect(overlapQuery?.groupPublicId).toEqual({ $ne: 'g1' });
      expect(updateMany.mock.calls[0][1]).toMatchObject({ $set: { startUTC: start, endUTC: end } });
      const rescheduled = emit.mock.calls.filter(([e]) => e === 'CLASS_RESCHEDULED').map(([, p]) => (p as { classPublicId: string }).classPublicId);
      expect(rescheduled).toEqual(['a', 'b']);
    });
  });
});
