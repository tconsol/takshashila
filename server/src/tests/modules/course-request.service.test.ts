import { courseRequestService } from '../../modules/course-requests/course-request.service';
import { CourseRequestModel } from '../../modules/course-requests/course-request.model';
import { CourseRequestStatus } from '../../modules/course-requests/course-request.types';
import { ScheduledClassModel } from '../../modules/schedules/schedule.model';
import { StudentProfileModel } from '../../modules/students/student.model';
import { TutorProfileModel } from '../../modules/tutors/tutor.model';
import { CourseModel } from '../../modules/courses/course.model';
import { courseService } from '../../modules/courses/course.service';
import { walletService } from '../../modules/wallets/wallet.service';
import { studentService } from '../../modules/students/student.service';
import { tutorService } from '../../modules/tutors/tutor.service';
import { classService } from '../../modules/classes/class.service';
import { domainEvents } from '../../events/event-emitter';
import { NotFoundError } from '../../utils/error';

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

function baseCourse(over: Record<string, unknown> = {}) {
  return {
    publicId: 'course-1',
    title: 'Algebra I',
    county: 'Fairfax',
    grade: '9',
    subject: 'Math',
    isPublished: true,
    topics: [
      { publicId: 'topic-1', title: 'Linear equations', order: 0 },
      { publicId: 'topic-2', title: 'Quadratics', order: 1 },
    ],
    ...over,
  };
}

function baseCreateDto(over: Record<string, unknown> = {}) {
  return {
    coursePublicId: 'course-1',
    selectedTopicPublicIds: ['topic-1'],
    tutorPublicId: 'tutor-prof-1',
    availabilityWindow: {
      daysOfWeek: [1, 2, 3],
      startLocalTime: '16:00',
      endLocalTime: '19:00',
      ianaTimezone: 'UTC',
    },
    ...over,
  };
}

describe('CourseRequestService', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('create', () => {
    it('propagates NotFoundError when the course does not exist', async () => {
      jest.spyOn(studentService, 'getByUserPublicId').mockResolvedValue({ publicId: 'student-prof-1' } as never);
      jest.spyOn(courseService, 'getByPublicId').mockRejectedValue(new NotFoundError('Course') as never);
      const createSpy = jest.spyOn(CourseRequestModel, 'create');

      await expect(
        courseRequestService.create('student-user-1', baseCreateDto()),
      ).rejects.toThrow(NotFoundError);
      expect(createSpy).not.toHaveBeenCalled();
    });

    it('rejects with 400 when the course is not published', async () => {
      jest.spyOn(studentService, 'getByUserPublicId').mockResolvedValue({ publicId: 'student-prof-1' } as never);
      jest.spyOn(courseService, 'getByPublicId').mockResolvedValue(baseCourse({ isPublished: false }) as never);
      const createSpy = jest.spyOn(CourseRequestModel, 'create');

      await expect(
        courseRequestService.create('student-user-1', baseCreateDto()),
      ).rejects.toThrow('Course is not available');
      expect(createSpy).not.toHaveBeenCalled();
    });

    it('rejects with 400 when a selected topic does not belong to the course', async () => {
      jest.spyOn(studentService, 'getByUserPublicId').mockResolvedValue({ publicId: 'student-prof-1' } as never);
      jest.spyOn(courseService, 'getByPublicId').mockResolvedValue(baseCourse() as never);
      const createSpy = jest.spyOn(CourseRequestModel, 'create');

      await expect(
        courseRequestService.create('student-user-1', baseCreateDto({ selectedTopicPublicIds: ['not-a-real-topic'] })),
      ).rejects.toThrow('One or more selected topics do not belong to this course');
      expect(createSpy).not.toHaveBeenCalled();
    });

    it('throws before creating the row when the tutor id is bad', async () => {
      jest.spyOn(studentService, 'getByUserPublicId').mockResolvedValue({ publicId: 'student-prof-1' } as never);
      jest.spyOn(courseService, 'getByPublicId').mockResolvedValue(baseCourse() as never);
      jest.spyOn(tutorService, 'getByPublicId').mockRejectedValue(new NotFoundError('Tutor') as never);
      const createSpy = jest.spyOn(CourseRequestModel, 'create');

      await expect(
        courseRequestService.create('student-user-1', baseCreateDto()),
      ).rejects.toThrow(NotFoundError);
      expect(createSpy).not.toHaveBeenCalled();
    });

    it('creates the request when course/topics/tutor are all valid', async () => {
      jest.spyOn(studentService, 'getByUserPublicId').mockResolvedValue({ publicId: 'student-prof-1' } as never);
      jest.spyOn(courseService, 'getByPublicId').mockResolvedValue(baseCourse() as never);
      jest.spyOn(tutorService, 'getByPublicId').mockResolvedValue({ publicId: 'tutor-prof-1', userPublicId: 'tutor-user-1' } as never);
      jest.spyOn(CourseRequestModel, 'findOne').mockReturnValue(lean(null) as never);
      const createSpy = jest.spyOn(CourseRequestModel, 'create').mockResolvedValue(
        { toObject: () => baseRequest() } as never,
      );
      jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);

      const result = await courseRequestService.create('student-user-1', baseCreateDto());

      expect(createSpy).toHaveBeenCalledTimes(1);
      expect(result.publicId).toBe('cr-1');
    });

    it('allows requesting a course from a different grade than the student\'s', async () => {
      jest.spyOn(studentService, 'getByUserPublicId').mockResolvedValue({ publicId: 'student-prof-1', grade: 'Grade 6' } as never);
      jest.spyOn(courseService, 'getByPublicId').mockResolvedValue(baseCourse({ grade: 'Grade 10' }) as never);
      jest.spyOn(tutorService, 'getByPublicId').mockResolvedValue({ publicId: 'tutor-prof-1', userPublicId: 'tutor-user-1' } as never);
      jest.spyOn(CourseRequestModel, 'findOne').mockReturnValue(lean(null) as never);
      const createSpy = jest.spyOn(CourseRequestModel, 'create').mockResolvedValue({ toObject: () => baseRequest() } as never);
      jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);

      await courseRequestService.create('student-user-1', baseCreateDto());

      expect(createSpy).toHaveBeenCalledTimes(1);
    });
  });

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

    it('never debits the wallet when the status transition loses a race (findOneAndUpdate returns null)', async () => {
      jest.spyOn(tutorService, 'getByUserPublicId').mockResolvedValue(
        { publicId: 'tutor-prof-1', userPublicId: 'tutor-user-1', hourlyRateCents: 1500 } as never,
      );
      jest.spyOn(CourseRequestModel, 'findOne').mockReturnValue(lean(baseRequest()) as never);
      jest.spyOn(StudentProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'student-prof-1', userPublicId: 'student-user-1' }) as never);
      const debit = jest.spyOn(walletService, 'debitWallet').mockResolvedValue({} as never);
      // Simulate the request having been cancelled/accepted concurrently.
      jest.spyOn(CourseRequestModel, 'findOneAndUpdate').mockReturnValue(lean(null) as never);

      await expect(
        courseRequestService.accept('cr-1', 'tutor-user-1', { classesRequired: 4 }),
      ).rejects.toThrow('Request already processed');
      expect(debit).not.toHaveBeenCalled();
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
          courseTopicPublicId: 'topic-1',
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
          courseTopicPublicId: 'topic-1',
        }),
      ).rejects.toThrow();
    });

    it('rejects a class whose start is inside the window but whose end runs past it', async () => {
      const accepted = baseRequest({ status: CourseRequestStatus.ACCEPTED, classesRequired: 4, classesScheduledCount: 0, costCentsPerClass: 1500 });
      jest.spyOn(tutorService, 'getByUserPublicId').mockResolvedValue({ publicId: 'tutor-prof-1', userPublicId: 'tutor-user-1' } as never);
      jest.spyOn(CourseRequestModel, 'findOne').mockReturnValue(lean(accepted) as never);

      // Starts 18:59 (inside 16:00–19:00) but runs to 21:00 — past the window end.
      await expect(
        courseRequestService.scheduleClass('cr-1', 'tutor-user-1', {
          startUTC: '2026-09-30T18:59:00.000Z',
          endUTC: '2026-09-30T21:00:00.000Z',
          title: 'Runs past the window',
          courseTopicPublicId: 'topic-1',
        }),
      ).rejects.toThrow();
    });

    it('rejects a topic the student did not select for this request', async () => {
      const accepted = baseRequest({ status: CourseRequestStatus.ACCEPTED, classesRequired: 4, classesScheduledCount: 0, costCentsPerClass: 1500 });
      jest.spyOn(tutorService, 'getByUserPublicId').mockResolvedValue({ publicId: 'tutor-prof-1', userPublicId: 'tutor-user-1' } as never);
      jest.spyOn(CourseRequestModel, 'findOne').mockReturnValue(lean(accepted) as never);

      await expect(
        courseRequestService.scheduleClass('cr-1', 'tutor-user-1', {
          startUTC: '2026-09-30T17:00:00.000Z',
          endUTC: '2026-09-30T18:00:00.000Z',
          title: 'Wrong topic',
          courseTopicPublicId: 'topic-2',
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
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
      // Authorization: the actor resolves to this request's student.
      jest.spyOn(studentService, 'getByUserPublicId').mockResolvedValue({ publicId: 'student-prof-1' } as never);
      jest.spyOn(tutorService, 'getByUserPublicId').mockRejectedValue(new Error('no tutor profile') as never);
      jest.spyOn(ScheduledClassModel, 'find').mockReturnValue(lean([{ publicId: 'scheduled-class-1' }]) as never);
      const cancelClassSpy = jest.spyOn(classService, 'cancelClass').mockResolvedValue({} as never);
      jest.spyOn(studentService, 'getByPublicId').mockResolvedValue({ userPublicId: 'student-user-1' } as never);
      const refund = jest.spyOn(walletService, 'refundWallet').mockResolvedValue({} as never);
      jest.spyOn(CourseRequestModel, 'findOneAndUpdate').mockReturnValue(lean({ ...accepted, status: CourseRequestStatus.CANCELLED }) as never);
      jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);

      await courseRequestService.cancel('cr-1', 'student-user-1');

      expect(cancelClassSpy).toHaveBeenCalledWith('scheduled-class-1', 'student-user-1', expect.objectContaining({ reason: expect.any(String) }));
      // classesScheduledCount is monotonic (never decremented), so it already
      // covers classesCompletedCount too: neverScheduled = classesRequired(4) -
      // classesScheduledCount(1) = 3 never-scheduled → 3 × 1500 = 4500.
      expect(refund).toHaveBeenCalledWith(expect.objectContaining({ ownerPublicId: 'student-user-1', amountCents: 4500 }));
    });

    it('rejects when the actor is neither the request\'s student nor its tutor', async () => {
      const accepted = baseRequest({
        status: CourseRequestStatus.ACCEPTED,
        classesRequired: 4,
        classesScheduledCount: 1,
        classesCompletedCount: 1,
        costCentsPerClass: 1500,
      });
      jest.spyOn(CourseRequestModel, 'findOne').mockReturnValue(lean(accepted) as never);
      // Actor resolves to a student/tutor profile, but neither matches this request's ids.
      jest.spyOn(studentService, 'getByUserPublicId').mockResolvedValue({ publicId: 'some-other-student-prof' } as never);
      jest.spyOn(tutorService, 'getByUserPublicId').mockRejectedValue(new Error('no tutor profile') as never);

      await expect(courseRequestService.cancel('cr-1', 'random-user')).rejects.toThrow();
    });
  });

  describe('getForTutor enrichment', () => {
    it('attaches studentName, tutorName, courseTitle and topicTitles for a known fixture', async () => {
      jest.spyOn(tutorService, 'getByUserPublicId').mockResolvedValue({ publicId: 'tutor-prof-1', userPublicId: 'tutor-user-1' } as never);
      const chainable = (v: unknown) => ({
        sort: () => ({ skip: () => ({ limit: () => ({ lean: () => Promise.resolve(v) }) }) }),
      });
      jest.spyOn(CourseRequestModel, 'find').mockReturnValue(
        chainable([baseRequest({ selectedTopicPublicIds: ['topic-1', 'topic-2'] })]) as never,
      );
      jest.spyOn(CourseRequestModel, 'countDocuments').mockResolvedValue(1 as never);
      jest.spyOn(TutorProfileModel, 'find').mockReturnValue(lean([{ publicId: 'tutor-prof-1', userPublicId: 'tutor-user-1' }]) as never);
      jest.spyOn(StudentProfileModel, 'find').mockReturnValue(lean([{ publicId: 'student-prof-1', userPublicId: 'student-user-1' }]) as never);
      jest.spyOn(CourseModel, 'find').mockReturnValue(lean([baseCourse()]) as never);
      const { UserModel } = await import('../../modules/users/user.model');
      jest.spyOn(UserModel, 'find').mockReturnValue(
        lean([
          { publicId: 'tutor-user-1', firstName: 'Tara', lastName: 'Tutor' },
          { publicId: 'student-user-1', firstName: 'Sam', lastName: 'Student' },
        ]) as never,
      );

      const result = await courseRequestService.getForTutor('tutor-user-1', { limit: '20' } as never);

      expect(result.items[0]).toMatchObject({
        studentName: 'Sam Student',
        tutorName: 'Tara Tutor',
        courseTitle: 'Algebra I',
        topicTitles: ['Linear equations', 'Quadratics'],
      });
    });
  });
});
