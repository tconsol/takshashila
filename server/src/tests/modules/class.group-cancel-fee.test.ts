/* A tutor cancelling a group session pays one cancellation fee, not one per student. */
import { classService } from '../../modules/classes/class.service';
import { ScheduledClassModel } from '../../modules/schedules/schedule.model';
import { StudentProfileModel } from '../../modules/students/student.model';
import { TutorProfileModel } from '../../modules/tutors/tutor.model';
import { tutorService } from '../../modules/tutors/tutor.service';
import { walletService } from '../../modules/wallets/wallet.service';
import { domainEvents } from '../../events/event-emitter';
import { BillingMode, ClassStatus, ClassType } from '../../modules/schedules/schedule.types';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });
const HOUR = 3_600_000;

const record = (publicId: string, student: string, over: Record<string, unknown> = {}) => ({
  publicId, groupPublicId: 'g1', tutorPublicId: 'tp1', studentPublicId: student, title: 'Algebra',
  classType: ClassType.GROUP, status: ClassStatus.SCHEDULED, billingMode: BillingMode.STUDENT_REQUESTED,
  costCents: 2000, startUTC: new Date(Date.now() + 2 * HOUR), // inside the 24 hour free-cancel window
  ...over,
});

describe('cancelling a group session', () => {
  let debit: jest.SpyInstance;
  const all = [record('a', 's1'), record('b', 's2'), record('c', 's3')];

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(ScheduledClassModel, 'findOne').mockImplementation(((q: { publicId: string }) =>
      lean(all.find((r) => r.publicId === q.publicId))) as never);
    jest.spyOn(ScheduledClassModel, 'find').mockReturnValue(lean(all.slice(1)) as never);
    jest.spyOn(ScheduledClassModel, 'findOneAndUpdate').mockImplementation(((q: { publicId: string }) =>
      lean({ ...all.find((r) => r.publicId === q.publicId), status: ClassStatus.CANCELLED })) as never);
    jest.spyOn(ScheduledClassModel, 'countDocuments').mockResolvedValue(0 as never);
    jest.spyOn(tutorService, 'recordClassCancelled').mockResolvedValue(undefined as never);
    jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue(lean({ userPublicId: 'tu1' }) as never);
    jest.spyOn(StudentProfileModel, 'findOne').mockImplementation(((q: { publicId: string }) =>
      lean({ userPublicId: `u-${q.publicId}` })) as never);
    jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);
    debit = jest.spyOn(walletService, 'debitWallet').mockResolvedValue({} as never);
  });

  it('charges the tutor one fee for the whole session, on the record that was clicked', async () => {
    await classService.cancelSession('a', 'tu1', { reason: 'ill' } as never);
    expect(debit).toHaveBeenCalledTimes(1);
    expect(debit.mock.calls[0][0]).toMatchObject({ ownerPublicId: 'tu1', amountCents: 100, idempotencyKey: 'cancel-fee-a' });
  });

  it('every record is still cancelled', async () => {
    const update = ScheduledClassModel.findOneAndUpdate as unknown as jest.SpyInstance;
    await classService.cancelSession('a', 'tu1', { reason: 'ill' } as never);
    expect(update).toHaveBeenCalledTimes(3);
  });

  it('a student cancelling their own record still pays their own fee', async () => {
    await classService.cancelClass('b', 'u-s2', { reason: 'busy' } as never);
    expect(debit).toHaveBeenCalledTimes(1);
    expect(debit.mock.calls[0][0]).toMatchObject({ ownerPublicId: 'u-s2', idempotencyKey: 'cancel-fee-b' });
  });

  it('with plenty of notice nobody pays', async () => {
    const early = [record('a', 's1', { startUTC: new Date(Date.now() + 48 * HOUR) }), record('b', 's2', { startUTC: new Date(Date.now() + 48 * HOUR) })];
    (ScheduledClassModel.findOne as unknown as jest.SpyInstance).mockImplementation(((q: { publicId: string }) =>
      lean(early.find((r) => r.publicId === q.publicId))) as never);
    (ScheduledClassModel.find as unknown as jest.SpyInstance).mockReturnValue(lean(early.slice(1)) as never);
    await classService.cancelSession('a', 'tu1', { reason: 'ill' } as never);
    expect(debit).not.toHaveBeenCalled();
  });
});
