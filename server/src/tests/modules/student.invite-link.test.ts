/* acceptInvite / declineInvite act on the invite the student clicked, not their first profile. */
import { studentService } from '../../modules/students/student.service';
import { studentRepository } from '../../modules/students/student.repository';
import { StudentProfileModel } from '../../modules/students/student.model';
import { tutorRepository } from '../../modules/tutors/tutor.repository';
import { TutorProfileModel } from '../../modules/tutors/tutor.model';
import { userRepository } from '../../modules/users/user.repository';
import { walletService } from '../../modules/wallets/wallet.service';
import { domainEvents } from '../../events/event-emitter';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });

// A student already ACTIVE with an old tutor, plus a new PENDING invite from another tutor.
const oldLink = { publicId: 'p-old', userPublicId: 'u1', tutorPublicId: 't-old', status: 'ACTIVE' };
const invite = { publicId: 'p-new', userPublicId: 'u1', tutorPublicId: 't-new', status: 'PENDING_APPROVAL' };

describe('student invite accept/decline with several tutor links', () => {
  let findOne: jest.SpyInstance;
  let findOneAndUpdate: jest.SpyInstance;
  let updateOne: jest.SpyInstance;

  beforeEach(() => {
    jest.restoreAllMocks();
    // The "first profile" lookup returns the old ACTIVE link, which used to break accept.
    jest.spyOn(studentRepository, 'findByUserPublicId').mockResolvedValue(oldLink as never);
    findOne = jest.spyOn(StudentProfileModel, 'findOne').mockImplementation(((q: Record<string, unknown>) => {
      if (q.publicId === 'p-new') return lean(invite);
      if (q.publicId === 'p-old') return lean(oldLink);
      if (q.status === 'PENDING_APPROVAL') return lean(invite);
      return lean(null);
    }) as never);
    findOneAndUpdate = jest.spyOn(StudentProfileModel, 'findOneAndUpdate').mockReturnValue(lean({ ...invite, status: 'ACTIVE' }) as never);
    updateOne = jest.spyOn(StudentProfileModel, 'updateOne').mockResolvedValue({} as never);
    jest.spyOn(walletService, 'initializeDemoCredits').mockResolvedValue(undefined as never);
    jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue(lean({ userPublicId: 'tu-new' }) as never);
    jest.spyOn(userRepository, 'findByPublicId').mockResolvedValue({ firstName: 'S', lastName: 'T' } as never);
    jest.spyOn(tutorRepository, 'findByPublicId').mockResolvedValue(null as never);
    jest.spyOn(tutorRepository, 'incrementStats').mockResolvedValue(undefined as never);
    jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);
  });

  it('accepts the clicked invite even though the first profile is not pending', async () => {
    await studentService.acceptInvite('u1', 'p-new');
    expect(findOneAndUpdate.mock.calls[0][0]).toMatchObject({ publicId: 'p-new' });
    expect(findOneAndUpdate.mock.calls[0][1].$set).toMatchObject({ status: 'ACTIVE', tutorPublicId: 't-new' });
  });

  it('without a link id (legacy endpoint) picks the pending invite, not the first profile', async () => {
    await studentService.acceptInvite('u1');
    expect(findOneAndUpdate.mock.calls[0][0]).toMatchObject({ publicId: 'p-new' });
  });

  it('refuses to accept a link that is not pending', async () => {
    await expect(studentService.acceptInvite('u1', 'p-old')).rejects.toMatchObject({ statusCode: 409 });
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('refuses a link that belongs to someone else', async () => {
    findOne.mockImplementation((() => lean(null)) as never);
    await expect(studentService.acceptInvite('u1', 'p-other')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('declines the clicked invite and leaves the active link alone', async () => {
    await studentService.declineInvite('u1', 'p-new');
    expect(updateOne.mock.calls[0][0]).toMatchObject({ publicId: 'p-new' });
    expect(updateOne.mock.calls[0][1].$set).toMatchObject({ status: 'INACTIVE' });
  });
});
