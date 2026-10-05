/* Step 3 of the class exit rule: completion is judged on how long each person was present.
     tutor met the share           -> COMPLETED and billed (student short only adds a note)
     tutor short                   -> INCOMPLETE, no money moves
   Classes with no presence records, and prepaid course/program classes, keep the old rule
   (covered by class.money.test.ts). */
import { classService } from '../../modules/classes/class.service';
import { classPresenceService } from '../../modules/classes/class-presence.service';
import { ScheduledClassModel } from '../../modules/schedules/schedule.model';
import { StudentProfileModel } from '../../modules/students/student.model';
import { TutorProfileModel } from '../../modules/tutors/tutor.model';
import { ClassStatus, ClassType, BillingMode } from '../../modules/schedules/schedule.types';
import { walletService } from '../../modules/wallets/wallet.service';
import { tutorService } from '../../modules/tutors/tutor.service';
import { attendanceService } from '../../modules/attendance/attendance.service';
import { studentService } from '../../modules/students/student.service';
import { domainEvents } from '../../events/event-emitter';
import { DomainEvent } from '../../constants/events';

const MIN = 60_000;
const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });

/** A 60-minute class that ended 5 minutes ago, so manual Complete is allowed by time. */
function pastClass(over: Record<string, unknown> = {}) {
  return {
    publicId: 'class-1',
    tutorPublicId: 'tutor-prof-1',
    studentPublicId: 'student-prof-1',
    status: ClassStatus.LIVE,
    classType: ClassType.ONE_ON_ONE,
    costCents: 2000,
    billingMode: BillingMode.STUDENT_REQUESTED,
    durationMinutes: 60,
    title: 'Physics',
    startUTC: new Date(Date.now() - 65 * MIN),
    endUTC: new Date(Date.now() - 5 * MIN),
    studentJoinedAt: new Date(Date.now() - 64 * MIN),
    tutorJoinedAt: new Date(Date.now() - 64 * MIN),
    ...over,
  };
}

describe('attendance-based settlement', () => {
  let transfer: jest.SpyInstance;
  let debit: jest.SpyInstance;
  let update: jest.SpyInstance;
  let attendance: jest.SpyInstance;
  let emit: jest.SpyInstance;
  let minutes: jest.SpyInstance;

  /** Present minutes per user. */
  const present = (tutor: number, student: number) =>
    minutes.mockImplementation((async (_cls: unknown, userId: string) => (userId === 'tutor-user-1' ? tutor : student)) as never);

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(classPresenceService, 'hasPresenceData').mockResolvedValue(true);
    jest.spyOn(classPresenceService, 'requiredMinutes').mockResolvedValue(50);
    minutes = jest.spyOn(classPresenceService, 'attendedMinutes');
    present(60, 60);
    jest.spyOn(StudentProfileModel, 'findOne').mockReturnValue(lean({ userPublicId: 'student-user-1' }) as never);
    jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue(lean({ userPublicId: 'tutor-user-1' }) as never);
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(pastClass()) as never);
    update = jest.spyOn(ScheduledClassModel, 'findOneAndUpdate').mockImplementation(((_f: unknown, u: { $set: object }) =>
      lean({ ...pastClass(), ...u.$set })) as never);
    jest.spyOn(tutorService, 'getByPublicId').mockResolvedValue({ userPublicId: 'tutor-user-1' } as never);
    jest.spyOn(tutorService, 'recordClassCompleted').mockResolvedValue(undefined as never);
    attendance = jest.spyOn(attendanceService, 'markAttendance').mockResolvedValue({} as never);
    jest.spyOn(studentService, 'recordDemoClassUsed').mockResolvedValue(undefined as never);
    emit = jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);
    debit = jest.spyOn(walletService, 'debitWallet').mockResolvedValue({} as never);
    jest.spyOn(walletService, 'creditWallet').mockResolvedValue({} as never);
    transfer = jest.spyOn(walletService, 'transferWallet').mockResolvedValue({ debit: {}, credit: {} } as never);
  });

  const setOf = () => (update.mock.calls[0] as unknown as [unknown, { $set: Record<string, unknown> }])[1].$set;

  it('both attended enough: completed and billed, minutes recorded, no early-leave note', async () => {
    present(58, 55);
    await classService.completeClass('class-1', 'tutor-user-1');

    expect(transfer).toHaveBeenCalledTimes(1);
    expect(transfer.mock.calls[0][0]).toMatchObject({ debitAmountCents: 2100, creditAmountCents: 1900 });
    expect(setOf()).toMatchObject({
      status: ClassStatus.COMPLETED,
      attendedMinutes: { tutor: 58, student: 55 },
      requiredMinutes: 50,
      studentLeftEarly: false,
    });
  });

  it('exactly the required minutes is enough', async () => {
    present(50, 50);
    await classService.completeClass('class-1', 'tutor-user-1');
    expect(setOf().status).toBe(ClassStatus.COMPLETED);
    expect(transfer).toHaveBeenCalledTimes(1);
  });

  it('tutor met it, student did not: still completed and billed in full, with the note', async () => {
    present(58, 30);
    await classService.completeClass('class-1', 'tutor-user-1');

    expect(transfer).toHaveBeenCalledTimes(1);
    expect(transfer.mock.calls[0][0]).toMatchObject({ debitAmountCents: 2100, creditAmountCents: 1900 });
    expect(setOf()).toMatchObject({ status: ClassStatus.COMPLETED, studentLeftEarly: true });
    expect(attendance.mock.calls[0][0]).toMatchObject({ durationPresentMinutes: 30 });
  });

  it('student who never joined is not billed and gets no early-leave note', async () => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(pastClass({ studentJoinedAt: undefined })) as never);
    present(58, 0);
    await classService.completeClass('class-1', 'tutor-user-1');

    expect(transfer).not.toHaveBeenCalled();
    expect(setOf()).toMatchObject({ status: ClassStatus.COMPLETED, studentLeftEarly: false });
  });

  it('tutor short: incomplete, nothing charged or paid, room closed with an incomplete event', async () => {
    present(20, 58);
    const result = await classService.completeClass('class-1', 'tutor-user-1');

    expect(result.status).toBe(ClassStatus.INCOMPLETE);
    expect(setOf()).toMatchObject({
      status: ClassStatus.INCOMPLETE,
      attendedMinutes: { tutor: 20, student: 58 },
      requiredMinutes: 50,
    });
    expect(setOf().completedAt).toBeUndefined();
    expect(transfer).not.toHaveBeenCalled();
    expect(debit).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith(DomainEvent.CLASS_COMPLETED, expect.objectContaining({
      classPublicId: 'class-1', incomplete: true, studentUserPublicId: 'student-user-1',
    }));
  });

  it('tutor short in a TUTOR_INVITED class: incomplete and no hosted-class fee', async () => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(
      lean(pastClass({ billingMode: BillingMode.TUTOR_INVITED, costCents: 0 })) as never,
    );
    present(10, 58);
    await classService.completeClass('class-1', 'tutor-user-1');
    expect(setOf().status).toBe(ClassStatus.INCOMPLETE);
    expect(debit).not.toHaveBeenCalled();
  });

  it('tutor short on a demo: incomplete and no demo credits used', async () => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(
      lean(pastClass({ classType: ClassType.DEMO, costCents: 0 })) as never,
    );
    present(10, 58);
    await classService.completeClass('class-1', 'tutor-user-1');
    expect(setOf().status).toBe(ClassStatus.INCOMPLETE);
    expect(debit).not.toHaveBeenCalled();
  });

  it('keeps the student attendance when the class ends incomplete', async () => {
    present(20, 58);
    await classService.completeClass('class-1', 'tutor-user-1');
    expect(attendance.mock.calls[0][0]).toMatchObject({ status: 'PRESENT', durationPresentMinutes: 58 });
  });

  it('a lost race (already closed) does not settle twice', async () => {
    present(20, 58);
    update.mockReturnValue(lean(null) as never);
    await expect(classService.completeClass('class-1', 'tutor-user-1')).rejects.toThrow(/already completed or cancelled/);
    expect(emit).not.toHaveBeenCalled();
  });

  describe('manual Complete before the scheduled end', () => {
    const running = () => pastClass({
      startUTC: new Date(Date.now() - 30 * MIN),
      endUTC: new Date(Date.now() + 30 * MIN),
    });

    it('is refused while the tutor has not yet attended the required minutes', async () => {
      jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(running()) as never);
      present(30, 30);
      await expect(classService.completeClass('class-1', 'tutor-user-1', { manual: true }))
        .rejects.toThrow(/attended 30 of the 50 minutes.*20 more minute/);
      expect(update).not.toHaveBeenCalled();
    });

    it('is allowed once the tutor has attended the required minutes', async () => {
      jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(running()) as never);
      present(50, 20);
      await classService.completeClass('class-1', 'tutor-user-1', { manual: true });
      expect(setOf()).toMatchObject({ status: ClassStatus.COMPLETED, studentLeftEarly: true });
    });

    it('is allowed after the end even if the tutor was short: it then settles as incomplete', async () => {
      present(20, 58);
      await classService.completeClass('class-1', 'tutor-user-1', { manual: true });
      expect(setOf().status).toBe(ClassStatus.INCOMPLETE);
    });

    it('still refuses a class that has not started', async () => {
      jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(pastClass({
        startUTC: new Date(Date.now() + 10 * MIN), endUTC: new Date(Date.now() + 70 * MIN),
      })) as never);
      await expect(classService.completeClass('class-1', 'tutor-user-1', { manual: true })).rejects.toThrow(/not started/);
    });
  });

  describe('old rule is kept', () => {
    it('for a prepaid course class, presence is not even consulted', async () => {
      jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(
        lean(pastClass({ billingMode: BillingMode.COURSE_PREPAID })) as never,
      );
      await classService.completeClass('class-1', 'tutor-user-1');
      expect(classPresenceService.hasPresenceData).not.toHaveBeenCalled();
      expect(minutes).not.toHaveBeenCalled();
      expect(setOf().status).toBe(ClassStatus.COMPLETED);
    });

    it('for a class with no presence records', async () => {
      (classPresenceService.hasPresenceData as jest.Mock).mockResolvedValue(false);
      await classService.completeClass('class-1', 'tutor-user-1');
      expect(minutes).not.toHaveBeenCalled();
      expect(setOf().status).toBe(ClassStatus.COMPLETED);
      expect(setOf().attendedMinutes).toBeUndefined();
      expect(transfer).toHaveBeenCalledTimes(1);
    });
  });

  describe('overdue sweep', () => {
    const overdue = (over: Record<string, unknown> = {}) => ({
      publicId: 'class-1', status: ClassStatus.LIVE, tutorPublicId: 'tutor-prof-1',
      billingMode: BillingMode.STUDENT_REQUESTED, endUTC: new Date(Date.now() - 20 * MIN), ...over,
    });
    let complete: jest.SpyInstance;
    let updateOne: jest.SpyInstance;

    beforeEach(() => {
      complete = jest.spyOn(classService, 'completeClass').mockResolvedValue({} as never);
      updateOne = jest.spyOn(ScheduledClassModel, 'updateOne').mockResolvedValue({} as never);
      jest.spyOn(ScheduledClassModel, 'find').mockReturnValue({
        limit: () => ({ lean: () => Promise.resolve([overdue({ studentJoinedAt: undefined, tutorJoinedAt: undefined })]) }),
      } as never);
      update.mockReturnValue(lean(overdue()) as never);
    });

    it('hands a class with presence records to completeClass instead of holding it for the tutor', async () => {
      const result = await classService.autoResolveOverdueClasses();
      expect(complete).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({ completed: 1, held: 0 });
      expect(updateOne).not.toHaveBeenCalledWith(expect.anything(), { $set: { needsTutorDecision: true } });
    });

    it('still holds a short legacy class (no presence records) for the tutor', async () => {
      (classPresenceService.hasPresenceData as jest.Mock).mockResolvedValue(false);
      const result = await classService.autoResolveOverdueClasses();
      expect(complete).not.toHaveBeenCalled();
      expect(result.held).toBe(1);
    });
  });
});
