import { courseService } from '../../modules/courses/course.service';
import { CourseModel } from '../../modules/courses/course.model';
import { CourseStatus } from '../../modules/courses/course.types';
import { StudentProfileModel } from '../../modules/students/student.model';
import { walletService } from '../../modules/wallets/wallet.service';
import { tutorService } from '../../modules/tutors/tutor.service';
import { domainEvents } from '../../events/event-emitter';
import { AppError } from '../../utils/error';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });
const pending = { publicId: 'cr-1', studentPublicId: 's-1', tutorPublicId: 't-1', curriculumPublicId: 'c-1', status: CourseStatus.PENDING };

describe('courseService.accept - failed debit', () => {
  beforeEach(() => {
    jest.spyOn(tutorService, 'getByUserPublicId').mockResolvedValue({ publicId: 't-1', userPublicId: 'tu-1', hourlyRateCents: 1500 } as never);
    jest.spyOn(CourseModel, 'findOne').mockReturnValue(lean(pending) as never);
    jest.spyOn(StudentProfileModel, 'findOne').mockReturnValue(lean({ publicId: 's-1', userPublicId: 'su-1' }) as never);
    jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);
  });

  it('reverts to PENDING and throws a readable 402 when the student cannot pay', async () => {
    jest.spyOn(walletService, 'debitWallet').mockRejectedValue(new AppError('Insufficient credits', 402));
    const upd = jest.spyOn(CourseModel, 'findOneAndUpdate')
      .mockReturnValueOnce(lean({ ...pending, status: CourseStatus.ACCEPTED }) as never)
      .mockResolvedValueOnce({} as never);

    await expect(courseService.accept('cr-1', 'tu-1', { classesRequired: 4 })).rejects.toMatchObject({
      statusCode: 402,
      message: expect.stringContaining('insufficient credits'),
    });

    expect(upd).toHaveBeenCalledTimes(2);
    expect(upd.mock.calls[1][0]).toMatchObject({ publicId: 'cr-1', status: CourseStatus.ACCEPTED });
    expect((upd.mock.calls[1][1] as { $set: { status: string } }).$set.status).toBe(CourseStatus.PENDING);
    expect(domainEvents.emit).not.toHaveBeenCalled();
  });

  it('also reverts on unexpected debit errors and rethrows them', async () => {
    jest.spyOn(walletService, 'debitWallet').mockRejectedValue(new Error('db down'));
    const upd = jest.spyOn(CourseModel, 'findOneAndUpdate')
      .mockReturnValueOnce(lean({ ...pending, status: CourseStatus.ACCEPTED }) as never)
      .mockResolvedValueOnce({} as never);
    await expect(courseService.accept('cr-1', 'tu-1', { classesRequired: 2 })).rejects.toThrow('db down');
    expect(upd).toHaveBeenCalledTimes(2);
  });

  it('keeps the stable idempotency key on the debit', async () => {
    const debit = jest.spyOn(walletService, 'debitWallet').mockResolvedValue({} as never);
    jest.spyOn(CourseModel, 'findOneAndUpdate').mockReturnValue(lean({ ...pending, status: CourseStatus.ACCEPTED }) as never);
    await courseService.accept('cr-1', 'tu-1', { classesRequired: 2 });
    expect(debit).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: 'course-request-accept-cr-1', amountCents: 3000 }));
  });
});
