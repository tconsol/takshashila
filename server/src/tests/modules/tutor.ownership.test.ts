import { TutorService } from '../../modules/tutors/tutor.service';
import { tutorRepository } from '../../modules/tutors/tutor.repository';
import { TutorStatus } from '../../modules/tutors/tutor.types';
import { Role } from '../../constants/roles';

const profile = (status = TutorStatus.UNDER_VERIFICATION) =>
  ({ publicId: 'tut-1', userPublicId: 'u-tut', principalPublicId: 'prin-1', status }) as never;

describe('TutorService approve/suspend/reactivate ownership', () => {
  const service = new TutorService();

  beforeEach(() => {
    jest.spyOn(tutorRepository, 'findByPublicId').mockResolvedValue(profile());
    jest.spyOn(tutorRepository, 'update').mockResolvedValue({ publicId: 'tut-1', userPublicId: 'u-tut' } as never);
  });

  describe('approve', () => {
    it('lets the owning principal approve', async () => {
      await expect(service.approve('tut-1', 'prin-1', Role.PRINCIPAL)).resolves.toBeDefined();
      expect(tutorRepository.update).toHaveBeenCalled();
    });
    it('rejects another principal with 403', async () => {
      await expect(service.approve('tut-1', 'prin-2', Role.PRINCIPAL)).rejects.toMatchObject({ statusCode: 403 });
      expect(tutorRepository.update).not.toHaveBeenCalled();
    });
    it('lets an admin approve any tutor', async () => {
      await expect(service.approve('tut-1', 'admin-1', Role.ADMIN)).resolves.toBeDefined();
    });
    it('lets a super admin approve any tutor', async () => {
      await expect(service.approve('tut-1', 'sa-1', Role.SUPER_ADMIN)).resolves.toBeDefined();
    });
    it('rejects non-admin, non-principal roles', async () => {
      await expect(service.approve('tut-1', 'x', Role.TUTOR)).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe.each([['suspend'], ['reactivate']] as const)('%s', (method) => {
    it('lets the owning principal', async () => {
      await expect(service[method]('tut-1', { userPublicId: 'prin-1', role: Role.PRINCIPAL })).resolves.toBeDefined();
    });
    it('rejects another principal with 403 and does not update', async () => {
      await expect(service[method]('tut-1', { userPublicId: 'prin-2', role: Role.PRINCIPAL })).rejects.toMatchObject({ statusCode: 403 });
      expect(tutorRepository.update).not.toHaveBeenCalled();
    });
    it('lets an admin', async () => {
      await expect(service[method]('tut-1', { userPublicId: 'admin-1', role: Role.ADMIN })).resolves.toBeDefined();
    });
  });
});
