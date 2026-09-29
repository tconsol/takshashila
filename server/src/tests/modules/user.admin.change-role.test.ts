import { UserAdminService } from '../../modules/users/user.admin.service';
import { userRepository } from '../../modules/users/user.repository';
import { TutorProfileModel } from '../../modules/tutors/tutor.model';
import { StudentProfileModel } from '../../modules/students/student.model';
import { ScheduledClassModel } from '../../modules/schedules/schedule.model';
import { ProgramEnrollmentModel } from '../../modules/programs/program.model';
import { WalletTransactionModel } from '../../modules/wallets/wallet-transaction.model';
import { auditService } from '../../modules/audit/audit.service';
import { Role } from '../../constants/roles';

jest.mock('../../modules/audit/audit.service', () => ({ auditService: { log: jest.fn() } }));

const actor = { publicId: 'sa-1', role: Role.SUPER_ADMIN } as never;
const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });

describe('UserAdminService.changeRole', () => {
  let service: UserAdminService;
  let update: jest.SpyInstance;

  beforeEach(() => {
    service = new UserAdminService();
    jest.spyOn(userRepository, 'findByPublicId').mockResolvedValue({ publicId: 'tut-u', role: Role.TUTOR } as never);
    update = jest.spyOn(userRepository, 'update').mockResolvedValue({} as never);
    jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'tp-1' }) as never);
    jest.spyOn(TutorProfileModel, 'updateOne').mockResolvedValue({} as never);
    jest.spyOn(StudentProfileModel, 'updateOne').mockResolvedValue({} as never);
    jest.spyOn(ScheduledClassModel, 'countDocuments').mockResolvedValue(0 as never);
    jest.spyOn(ProgramEnrollmentModel, 'countDocuments').mockResolvedValue(0 as never);
    jest.spyOn(WalletTransactionModel, 'countDocuments').mockResolvedValue(0 as never);
    jest.spyOn(service as never, 'ensureProfileFor').mockResolvedValue(undefined as never);
    jest.spyOn(service, 'getUserDetail').mockResolvedValue({ publicId: 'tut-u' } as never);
  });

  it('only a super admin may change roles', async () => {
    await expect(service.changeRole('tut-u', Role.STUDENT, { publicId: 'a', role: Role.ADMIN } as never))
      .rejects.toMatchObject({ statusCode: 403 });
  });
  it('cannot change your own role', async () => {
    (userRepository.findByPublicId as jest.Mock).mockResolvedValue({ publicId: 'sa-1', role: Role.SUPER_ADMIN });
    await expect(service.changeRole('sa-1', Role.STUDENT, actor)).rejects.toBeDefined();
    expect(update).not.toHaveBeenCalled();
  });

  it.each([
    ['scheduled/live classes', ScheduledClassModel, /class/],
    ['active program enrollments', ProgramEnrollmentModel, /enrollment/],
    ['pending payouts', WalletTransactionModel, /payout/],
  ])('blocks a tutor with %s (409) and changes nothing', async (_n, model, re) => {
    (model.countDocuments as unknown as jest.Mock).mockResolvedValue(2);
    await expect(service.changeRole('tut-u', Role.STUDENT, actor)).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringMatching(re),
    });
    expect(update).not.toHaveBeenCalled();
    expect(auditService.log).not.toHaveBeenCalled();
  });

  it('lists every blocker at once', async () => {
    (ScheduledClassModel.countDocuments as jest.Mock).mockResolvedValue(1);
    (WalletTransactionModel.countDocuments as jest.Mock).mockResolvedValue(1);
    await expect(service.changeRole('tut-u', Role.STUDENT, actor)).rejects.toThrow(/class.*payout/);
  });

  it('allows a clean tutor to change role and audits it', async () => {
    await expect(service.changeRole('tut-u', Role.STUDENT, actor, 'reason')).resolves.toBeDefined();
    expect(update).toHaveBeenCalledWith('tut-u', { role: Role.STUDENT });
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'USER_ROLE_CHANGED' }));
  });

  it('does not run the tutor blockers for non-tutors', async () => {
    (userRepository.findByPublicId as jest.Mock).mockResolvedValue({ publicId: 's-u', role: Role.STUDENT });
    (ScheduledClassModel.countDocuments as jest.Mock).mockResolvedValue(5);
    await expect(service.changeRole('s-u', Role.PARENT, actor)).resolves.toBeDefined();
    expect(update).toHaveBeenCalled();
  });
});
