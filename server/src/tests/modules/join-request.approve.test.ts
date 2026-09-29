import { JoinRequestService } from '../../modules/join-requests/join-request.service';
import { JoinRequestModel } from '../../modules/join-requests/join-request.model';
import { JoinRequestStatus, JoinRequestInitiator } from '../../modules/join-requests/join-request.types';
import { TutorProfileModel } from '../../modules/tutors/tutor.model';
import { PrincipalProfileModel } from '../../modules/principals/principal.model';
import { ScheduledClassModel } from '../../modules/schedules/schedule.model';
import { userRepository } from '../../modules/users/user.repository';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });
const REQ = {
  publicId: 'jr-1', status: JoinRequestStatus.PENDING, initiatedBy: JoinRequestInitiator.TUTOR,
  tutorUserPublicId: 'tu', tutorProfilePublicId: 'tp', principalUserPublicId: 'pu', principalProfilePublicId: 'pp',
};

describe('JoinRequestService approve/reject atomic transition', () => {
  const service = new JoinRequestService();
  let tutorUpdate: jest.SpyInstance;
  let principalUpdate: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(JoinRequestModel, 'findOne').mockReturnValue(lean(REQ) as never);
    jest.spyOn(JoinRequestModel, 'findOneAndUpdate').mockReturnValue(lean(REQ) as never);
    tutorUpdate = jest.spyOn(TutorProfileModel, 'findOneAndUpdate').mockResolvedValue({} as never);
    principalUpdate = jest.spyOn(PrincipalProfileModel, 'updateOne').mockResolvedValue({} as never);
  });

  it('approves and bumps the principal counter exactly once', async () => {
    await expect(service.approveRequest('jr-1', 'pu')).resolves.toMatchObject({ status: JoinRequestStatus.APPROVED });
    expect(JoinRequestModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ publicId: 'jr-1', status: JoinRequestStatus.PENDING }),
      { $set: { status: JoinRequestStatus.APPROVED } },
    );
    expect(principalUpdate).toHaveBeenCalledTimes(1);
    expect(tutorUpdate).toHaveBeenCalledTimes(1);
  });

  it('409s and does not double-count when the request was already approved concurrently', async () => {
    (JoinRequestModel.findOneAndUpdate as jest.Mock).mockReturnValue(lean(null));
    await expect(service.approveRequest('jr-1', 'pu')).rejects.toMatchObject({ statusCode: 409 });
    expect(principalUpdate).not.toHaveBeenCalled();
    expect(tutorUpdate).not.toHaveBeenCalled();
  });

  it('404s when the request is no longer pending at read time', async () => {
    (JoinRequestModel.findOne as jest.Mock).mockReturnValue(lean(null));
    await expect(service.approveRequest('jr-1', 'pu')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('403s when the actor is not the receiver', async () => {
    await expect(service.approveRequest('jr-1', 'tu')).rejects.toMatchObject({ statusCode: 403 });
    expect(JoinRequestModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('reject also 409s when already processed', async () => {
    (JoinRequestModel.findOneAndUpdate as jest.Mock).mockReturnValue(lean(null));
    await expect(service.rejectRequest('jr-1', 'pu', 'no')).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('JoinRequestService leave / switch organization', () => {
  const service = new JoinRequestService();
  afterEach(() => jest.restoreAllMocks());

  it('approving into a NEW org decrements the OLD principal and increments the new one', async () => {
    jest.spyOn(JoinRequestModel, 'findOne').mockReturnValue(lean(REQ) as never);
    jest.spyOn(JoinRequestModel, 'findOneAndUpdate').mockReturnValue(lean(REQ) as never);
    jest.spyOn(TutorProfileModel, 'findOneAndUpdate').mockResolvedValue({ principalPublicId: 'old-pu' } as never);
    const principalUpdate = jest.spyOn(PrincipalProfileModel, 'updateOne').mockResolvedValue({} as never);
    await service.approveRequest('jr-1', 'pu');
    const calls = (principalUpdate.mock.calls as unknown as [{ userPublicId: string }, { $inc: { totalTutors: number } }][]).map((c) => [c[0].userPublicId, c[1].$inc.totalTutors]);
    expect(calls).toEqual(expect.arrayContaining([['pu', 1], ['old-pu', -1]]));
  });

  it('tutor leave clears principal and decrements once; 409 when not in an org', async () => {
    jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'tp', userPublicId: 'tu', principalPublicId: 'pu' }) as never);
    const tutorUpdate = jest.spyOn(TutorProfileModel, 'findOneAndUpdate').mockResolvedValue({} as never);
    const principalUpdate = jest.spyOn(PrincipalProfileModel, 'updateOne').mockResolvedValue({} as never);
    jest.spyOn(ScheduledClassModel, 'countDocuments').mockResolvedValue(2 as never);
    jest.spyOn(userRepository, 'findByPublicId').mockResolvedValue({ firstName: 'T', lastName: 'U' } as never);
    await service.leaveOrganization('tu');
    expect(tutorUpdate.mock.calls[0][1]).toEqual({ $unset: { principalPublicId: '' } });
    expect(principalUpdate).toHaveBeenCalledTimes(1);

    (TutorProfileModel.findOne as jest.Mock).mockReturnValue(lean({ publicId: 'tp', userPublicId: 'tu' }));
    await expect(service.leaveOrganization('tu')).rejects.toMatchObject({ statusCode: 409 });
  });

  it("principal cannot remove another principal's tutor", async () => {
    jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'tp', userPublicId: 'tu', principalPublicId: 'other' }) as never);
    await expect(service.removeTutor('pu', 'tp')).rejects.toMatchObject({ statusCode: 404 });
  });
});
