import { DemoRequestService } from '../../modules/demo-requests/demo-request.service';
import { DemoRequestModel } from '../../modules/demo-requests/demo-request.model';
import { DemoRequestStatus } from '../../modules/demo-requests/demo-request.types';
import { scheduleService } from '../../modules/schedules/schedule.service';
import { ScheduledClassModel } from '../../modules/schedules/schedule.model';
import { StudentProfileModel } from '../../modules/students/student.model';
import { tutorService } from '../../modules/tutors/tutor.service';
import { walletService } from '../../modules/wallets/wallet.service';
import { adjustCountersForStatusChange } from '../../modules/students/student.service';

jest.mock('../../modules/students/student.service', () => ({
  studentService: {},
  adjustCountersForStatusChange: jest.fn(),
}));

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });
const REQ = {
  publicId: 'dr-1', tutorPublicId: 'tp-1', studentPublicId: 'sp-1', availabilitySlotPublicId: 'slot-1',
  status: DemoRequestStatus.PENDING, preferredSubject: 'Math', message: 'hi',
};
const SLOT = { publicId: 'slot-1', status: 'AVAILABLE', startUTC: new Date(), endUTC: new Date(), ianaTimezone: 'UTC', durationMinutes: 30 };

describe('DemoRequestService.accept claim/rollback', () => {
  const service = new DemoRequestService();
  let claim: jest.Mock;
  let revert: jest.SpyInstance;
  let block: jest.SpyInstance;
  let release: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(tutorService, 'getByUserPublicId').mockResolvedValue({ publicId: 'tp-1', principalPublicId: 'prin-1' } as never);
    jest.spyOn(DemoRequestModel, 'findOne').mockReturnValue(lean(REQ) as never);
    claim = jest.fn().mockImplementation((filter: { status?: string }) =>
      filter.status === DemoRequestStatus.PENDING
        ? lean({ ...REQ, status: DemoRequestStatus.ACCEPTED })
        : lean({ ...REQ, status: DemoRequestStatus.ACCEPTED, classPublicId: 'cls-1' }));
    jest.spyOn(DemoRequestModel, 'findOneAndUpdate').mockImplementation(claim as never);
    revert = jest.spyOn(DemoRequestModel, 'updateOne').mockResolvedValue({} as never);
    jest.spyOn(scheduleService, 'getSlotByPublicId').mockResolvedValue({ ...SLOT } as never);
    block = jest.spyOn(scheduleService, 'blockSlot').mockResolvedValue(undefined as never);
    release = jest.spyOn(scheduleService, 'releaseSlot').mockResolvedValue(undefined as never);
    jest.spyOn(ScheduledClassModel, 'create').mockResolvedValue({ publicId: 'cls-1' } as never);
    jest.spyOn(ScheduledClassModel, 'updateOne').mockResolvedValue({} as never);
    jest.spyOn(StudentProfileModel, 'findOneAndUpdate').mockReturnValue(lean({ userPublicId: 'su-1', status: 'PENDING_APPROVAL' }) as never);
    jest.spyOn(walletService, 'initializeDemoCredits').mockResolvedValue(undefined as never);
  });

  it('happy path claims first, blocks the slot, creates the class, adjusts counters', async () => {
    await expect(service.accept('dr-1', 'tu-1')).resolves.toMatchObject({ classPublicId: 'cls-1' });
    expect(claim.mock.calls[0][0]).toMatchObject({ publicId: 'dr-1', status: DemoRequestStatus.PENDING });
    expect(block).toHaveBeenCalledWith('slot-1');
    expect(adjustCountersForStatusChange).toHaveBeenCalledWith('PENDING_APPROVAL', 'ACTIVE', 'tp-1', 'prin-1');
    expect(revert).not.toHaveBeenCalled();
  });

  it('loser of a concurrent accept gets 409 and never touches the slot', async () => {
    claim.mockImplementationOnce(() => lean(null));
    await expect(service.accept('dr-1', 'tu-1')).rejects.toMatchObject({ statusCode: 409 });
    expect(block).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
    expect(revert).not.toHaveBeenCalled();
  });

  it('non-pending request is rejected before claiming', async () => {
    (DemoRequestModel.findOne as jest.Mock).mockReturnValue(lean({ ...REQ, status: DemoRequestStatus.ACCEPTED }));
    await expect(service.accept('dr-1', 'tu-1')).rejects.toMatchObject({ statusCode: 409 });
    expect(claim).not.toHaveBeenCalled();
  });

  it('unavailable slot reverts the claim but does NOT release the slot', async () => {
    (scheduleService.getSlotByPublicId as jest.Mock).mockResolvedValue({ ...SLOT, status: 'BLOCKED' });
    await expect(service.accept('dr-1', 'tu-1')).rejects.toMatchObject({ statusCode: 409 });
    expect(block).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
    expect(revert).toHaveBeenCalledWith(
      { publicId: 'dr-1', status: DemoRequestStatus.ACCEPTED },
      expect.objectContaining({ $set: { status: DemoRequestStatus.PENDING } }),
    );
  });

  it('slot lookup failure reverts the claim', async () => {
    (scheduleService.getSlotByPublicId as jest.Mock).mockRejectedValue(new Error('boom'));
    await expect(service.accept('dr-1', 'tu-1')).rejects.toThrow('boom');
    expect(revert).toHaveBeenCalled();
    expect(block).not.toHaveBeenCalled();
  });

  it('class creation failure releases the slot it blocked and reverts the claim', async () => {
    (ScheduledClassModel.create as jest.Mock).mockRejectedValue(new Error('db down'));
    await expect(service.accept('dr-1', 'tu-1')).rejects.toThrow('db down');
    expect(release).toHaveBeenCalledWith('slot-1');
    expect(revert).toHaveBeenCalled();
    expect(ScheduledClassModel.updateOne).not.toHaveBeenCalled();
  });

  it('failure after class creation soft-deletes the class too', async () => {
    (StudentProfileModel.findOneAndUpdate as jest.Mock).mockImplementation(() => { throw new Error('late'); });
    await expect(service.accept('dr-1', 'tu-1')).rejects.toThrow('late');
    expect(ScheduledClassModel.updateOne).toHaveBeenCalledWith({ publicId: 'cls-1' }, { $set: { isDeleted: true } });
    expect(release).toHaveBeenCalledWith('slot-1');
    expect(revert).toHaveBeenCalled();
  });
});
