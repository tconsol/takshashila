import { settingsService } from '../../modules/settings/settings.service';
import { PlatformSettingsModel } from '../../modules/settings/settings.model';
import { auditService } from '../../modules/audit/audit.service';
import { Role } from '../../constants/roles';

jest.mock('../../modules/audit/audit.service', () => ({ auditService: { log: jest.fn() } }));

const actor = { publicId: 'sa-1', role: Role.SUPER_ADMIN };
const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });

describe('SettingsService.update min/max merge validation', () => {
  let stored: Record<string, unknown>;

  beforeEach(() => {
    stored = { key: 'platform', minClassDurationMinutes: 30, maxClassDurationMinutes: 90, featureFlags: {} };
    jest.spyOn(settingsService, 'get').mockImplementation(async () => stored as never);
    jest.spyOn(PlatformSettingsModel, 'findOneAndUpdate').mockImplementation(((_f: unknown, u: { $set: object }) =>
      lean({ ...stored, ...u.$set })) as never);
  });

  it('rejects raising min above the STORED max', async () => {
    await expect(settingsService.update({ minClassDurationMinutes: 120 }, actor)).rejects.toMatchObject({
      message: expect.stringMatching(/cannot exceed/),
    });
    expect(PlatformSettingsModel.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('rejects lowering max below the STORED min', async () => {
    await expect(settingsService.update({ maxClassDurationMinutes: 10 }, actor)).rejects.toMatchObject({
      message: expect.stringMatching(/cannot exceed/),
    });
  });
  it('rejects an inconsistent pair in one patch', async () => {
    await expect(
      settingsService.update({ minClassDurationMinutes: 100, maxClassDurationMinutes: 50 }, actor),
    ).rejects.toThrow(/cannot exceed/);
  });
  it('accepts a patch that is consistent with the stored other bound', async () => {
    await expect(settingsService.update({ minClassDurationMinutes: 60 }, actor)).resolves.toMatchObject({
      minClassDurationMinutes: 60,
    });
    expect(auditService.log).toHaveBeenCalled();
  });
  it('accepts min equal to max', async () => {
    await expect(settingsService.update({ maxClassDurationMinutes: 30 }, actor)).resolves.toBeDefined();
  });
});
