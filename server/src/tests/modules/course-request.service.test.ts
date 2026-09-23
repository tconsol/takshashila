import { courseRequestService } from '../../modules/course-requests/course-request.service';
import { CourseRequestModel } from '../../modules/course-requests/course-request.model';
import { CourseRequestStatus } from '../../modules/course-requests/course-request.types';
import { ScheduledClassModel } from '../../modules/schedules/schedule.model';
import { StudentProfileModel } from '../../modules/students/student.model';
import { walletService } from '../../modules/wallets/wallet.service';
import { studentService } from '../../modules/students/student.service';
import { tutorService } from '../../modules/tutors/tutor.service';
import { classService } from '../../modules/classes/class.service';
import { domainEvents } from '../../events/event-emitter';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });

function baseRequest(over: Record<string, unknown> = {}) {
  return {
    publicId: 'cr-1',
    studentPublicId: 'student-prof-1',
    tutorPublicId: 'tutor-prof-1',
    coursePublicId: 'course-1',
    selectedTopicPublicIds: ['topic-1'],
    availabilityWindow: {
      daysOfWeek: [1, 2, 3, 4, 5],
      startLocalTime: '16:00',
      endLocalTime: '19:00',
      ianaTimezone: 'UTC',
    },
    status: CourseRequestStatus.PENDING,
    classesScheduledCount: 0,
    classesCompletedCount: 0,
    isDeleted: false,
    ...over,
  };
}

describe('CourseRequestService', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('accept', () => {
    it('charges the student classesRequired × tutor rate and marks ACCEPTED', async () => {
      jest.spyOn(tutorService, 'getByUserPublicId').mockResolvedValue(
        { publicId: 'tutor-prof-1', userPublicId: 'tutor-user-1', hourlyRateCents: 1500 } as never,
      );
      jest.spyOn(CourseRequestModel, 'findOne').mockReturnValue(lean(baseRequest()) as never);
      jest.spyOn(StudentProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'student-prof-1', userPublicId: 'student-user-1' }) as never);
      const debit = jest.spyOn(walletService, 'debitWallet').mockResolvedValue({} as never);
      jest.spyOn(CourseRequestModel, 'findOneAndUpdate').mockReturnValue(
        lean(baseRequest({ status: CourseRequestStatus.ACCEPTED, classesRequired: 4, costCentsPerClass: 1500 })) as never,
      );
      jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);

      const result = await courseRequestService.accept('cr-1', 'tutor-user-1', { classesRequired: 4 });

      expect(debit).toHaveBeenCalledWith(
        expect.objectContaining({ ownerPublicId: 'student-user-1', amountCents: 6000 }), // 4 × 1500
      );
      expect(result.status).toBe('ACCEPTED');
    });

    it('rejects accepting a request that is not PENDING', async () => {
      jest.spyOn(tutorService, 'getByUserPublicId').mockResolvedValue({ publicId: 'tutor-prof-1', userPublicId: 'tutor-user-1', hourlyRateCents: 1500 } as never);
      jest.spyOn(CourseRequestModel, 'findOne').mockReturnValue(lean(baseRequest({ status: CourseRequestStatus.ACCEPTED })) as never);

      await expect(courseRequestService.accept('cr-1', 'tutor-user-1', { classesRequired: 4 })).rejects.toThrow();
    });
  });

  describe('scheduleClass', () => {
    it('creates a COURSE_PREPAID class and increments classesScheduledCount when inside the window', async () => {
      const accepted = baseRequest({
        status: CourseRequestStatus.ACCEPTED,
        classesRequired: 4,
        classesScheduledCount: 1,
        costCentsPerClass: 1500,
      });
      jest.spyOn(tutorService, 'getByUserPublicId').mockResolvedValue({ publicId: 'tutor-prof-1', userPublicId: 'tutor-user-1' } as never);
      jest.spyOn(CourseRequestModel, 'findOne').mockReturnValue(lean(accepted) as never);
      const createSpy = jest.spyOn(ScheduledClassModel, 'create').mockResolvedValue(
        { toObject: () => ({ publicId: 'new-class-1' }) } as never,
      );
      const incSpy = jest.spyOn(CourseRequestModel, 'findOneAndUpdate').mockReturnValue(lean({ ...accepted, classesScheduledCount: 2 }) as never);
      jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);

      // Wednesday (day 3) 17:00–18:00 UTC — inside daysOfWeek [1..5], 16:00–19:00 window
      await courseRequestService.scheduleClass('cr-1', 'tutor-user-1', {
        startUTC: '2026-09-30T17:00:00.000Z', // a Wednesday
        endUTC: '2026-09-30T18:00:00.000Z',
        title: 'Algebra I – Session 2',
        courseTopicPublicId: 'topic-1',
      });

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          billingMode: 'COURSE_PREPAID',
          costCents: 1500,
          courseRequestPublicId: 'cr-1',
          coursePublicId: 'course-1',
          courseTopicPublicId: 'topic-1',
        }),
      );
      expect(incSpy).toHaveBeenCalledWith(
        { publicId: 'cr-1', classesScheduledCount: { $lt: 4 } },
        { $inc: { classesScheduledCount: 1 } },
        { new: true },
      );
    });

    it('rejects a time outside the stated availability window', async () => {
      const accepted = baseRequest({ status: CourseRequestStatus.ACCEPTED, classesRequired: 4, classesScheduledCount: 0, costCentsPerClass: 1500 });
      jest.spyOn(tutorService, 'getByUserPublicId').mockResolvedValue({ publicId: 'tutor-prof-1', userPublicId: 'tutor-user-1' } as never);
      jest.spyOn(CourseRequestModel, 'findOne').mockReturnValue(lean(accepted) as never);

      // 20:00 UTC is after the 19:00 window end
      await expect(
        courseRequestService.scheduleClass('cr-1', 'tutor-user-1', {
          startUTC: '2026-09-30T20:00:00.000Z',
          endUTC: '2026-09-30T21:00:00.000Z',
          title: 'Late session',
        }),
      ).rejects.toThrow();
    });

    it('rejects once classesScheduledCount already equals classesRequired', async () => {
      const full = baseRequest({ status: CourseRequestStatus.ACCEPTED, classesRequired: 4, classesScheduledCount: 4, costCentsPerClass: 1500 });
      jest.spyOn(tutorService, 'getByUserPublicId').mockResolvedValue({ publicId: 'tutor-prof-1', userPublicId: 'tutor-user-1' } as never);
      jest.spyOn(CourseRequestModel, 'findOne').mockReturnValue(lean(full) as never);

      await expect(
        courseRequestService.scheduleClass('cr-1', 'tutor-user-1', {
          startUTC: '2026-09-30T17:00:00.000Z',
          endUTC: '2026-09-30T18:00:00.000Z',
          title: 'One too many',
        }),
      ).rejects.toThrow();
    });
  });

  describe('cancel', () => {
    it('cancels remaining scheduled classes and refunds the never-scheduled remainder', async () => {
      const accepted = baseRequest({
        status: CourseRequestStatus.ACCEPTED,
        classesRequired: 4,
        classesScheduledCount: 1,
        classesCompletedCount: 1,
        costCentsPerClass: 1500,
      });
      jest.spyOn(CourseRequestModel, 'findOne').mockReturnValue(lean(accepted) as never);
      jest.spyOn(ScheduledClassModel, 'find').mockReturnValue(lean([{ publicId: 'scheduled-class-1' }]) as never);
      const cancelClassSpy = jest.spyOn(classService, 'cancelClass').mockResolvedValue({} as never);
      jest.spyOn(studentService, 'getByPublicId').mockResolvedValue({ userPublicId: 'student-user-1' } as never);
      const refund = jest.spyOn(walletService, 'refundWallet').mockResolvedValue({} as never);
      jest.spyOn(CourseRequestModel, 'findOneAndUpdate').mockReturnValue(lean({ ...accepted, status: CourseRequestStatus.CANCELLED }) as never);
      jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);

      await courseRequestService.cancel('cr-1', 'student-user-1');

      expect(cancelClassSpy).toHaveBeenCalledWith('scheduled-class-1', 'student-user-1', expect.objectContaining({ reason: expect.any(String) }));
      // classesRequired(4) - classesScheduledCount(1) - classesCompletedCount(1) = 2 never-scheduled → 2 × 1500 = 3000
      expect(refund).toHaveBeenCalledWith(expect.objectContaining({ ownerPublicId: 'student-user-1', amountCents: 3000 }));
    });
  });
});
