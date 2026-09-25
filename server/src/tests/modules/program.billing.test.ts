// server/src/tests/modules/program.billing.test.ts
import { classService } from '../../modules/classes/class.service';
import { ScheduledClassModel } from '../../modules/schedules/schedule.model';
import { TutorProfileModel } from '../../modules/tutors/tutor.model';
import { StudentProfileModel } from '../../modules/students/student.model';
import { ProgramEnrollmentModel, ProgramModel } from '../../modules/programs/program.model';
import { walletService } from '../../modules/wallets/wallet.service';
import { tutorService } from '../../modules/tutors/tutor.service';
import { domainEvents } from '../../events/event-emitter';
import { isPrepaid, BillingMode } from '../../modules/schedules/schedule.types';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });

describe('PROGRAM_PREPAID billing', () => {
  afterEach(() => jest.restoreAllMocks());

  it('isPrepaid covers course and program modes only', () => {
    expect(isPrepaid(BillingMode.COURSE_PREPAID)).toBe(true);
    expect(isPrepaid(BillingMode.PROGRAM_PREPAID)).toBe(true);
    expect(isPrepaid(BillingMode.STUDENT_REQUESTED)).toBe(false);
  });

  it('refunds a cancelled program session\'s cost to the student', async () => {
    const cls = {
      publicId: 'k-1', tutorPublicId: 'tp-1', studentPublicId: 'sp-1', status: 'SCHEDULED', title: 'Chess 1',
      costCents: 1500, billingMode: 'PROGRAM_PREPAID', programEnrollmentPublicId: 'e-1', startUTC: new Date(Date.now() + 86400000),
    };
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(cls) as never);
    jest.spyOn(ScheduledClassModel, 'findOneAndUpdate').mockReturnValue(lean({ ...cls, status: 'CANCELLED' }) as never);
    jest.spyOn(StudentProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'sp-1', userPublicId: 'su-1' }) as never);
    jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'tp-1', userPublicId: 'tu-1' }) as never);
    jest.spyOn(tutorService, 'recordClassCancelled').mockResolvedValue(undefined as never);
    jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);
    const refund = jest.spyOn(walletService, 'refundWallet').mockResolvedValue({} as never);
    const fee = jest.spyOn(walletService, 'debitWallet');

    await classService.cancelClass('k-1', 'tu-1', { reason: 'x' }).catch(() => undefined);

    expect(refund).toHaveBeenCalledWith(expect.objectContaining({ ownerPublicId: 'su-1', amountCents: 1500 }));
    expect(fee).not.toHaveBeenCalled(); // prepaid modes skip the cancellation fee
  });

  it('completing the last session completes the enrollment and frees the seat', async () => {
    const incEnrollment = jest.spyOn(ProgramEnrollmentModel, 'findOneAndUpdate')
      .mockReturnValueOnce(lean({ publicId: 'e-1', programPublicId: 'p-1', status: 'ACTIVE', sessionCount: 2, sessionsCompletedCount: 2 }) as never)
      .mockReturnValueOnce(lean({ publicId: 'e-1', status: 'COMPLETED' }) as never);
    const seat = jest.spyOn(ProgramModel, 'updateOne').mockResolvedValue({} as never);
    const emit = jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);

    await classService.recordProgramSessionCompleted('e-1');

    expect(incEnrollment).toHaveBeenNthCalledWith(1, { publicId: 'e-1' }, { $inc: { sessionsCompletedCount: 1 } }, { new: true });
    expect(incEnrollment).toHaveBeenNthCalledWith(2, { publicId: 'e-1', status: 'ACTIVE' }, { $set: { status: 'COMPLETED' } }, { new: true });
    expect(seat).toHaveBeenCalledWith({ publicId: 'p-1' }, { $inc: { activeEnrollmentCount: -1 } });
    expect(emit).toHaveBeenCalledWith('PROGRAM_ENROLLMENT_COMPLETED', { enrollmentPublicId: 'e-1' });
  });
});
