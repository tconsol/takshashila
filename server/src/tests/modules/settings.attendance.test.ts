import { settingsService } from '../../modules/settings/settings.service';
import { PlatformSettingsModel, PLATFORM_SETTINGS_DEFAULTS } from '../../modules/settings/settings.model';
import { Role } from '../../constants/roles';

jest.mock('../../modules/audit/audit.service', () => ({ auditService: { log: jest.fn() } }));

const actor = { publicId: 'sa-1', role: Role.SUPER_ADMIN };
const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });

describe('attendance settings', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    settingsService.invalidate();
  });

  it('ships the decided defaults: 83% and 5 minutes', () => {
    expect(PLATFORM_SETTINGS_DEFAULTS.minAttendancePercent).toBe(83);
    expect(PLATFORM_SETTINGS_DEFAULTS.disconnectGraceMinutes).toBe(5);
  });

  it('reads defaults when the stored row predates the fields', async () => {
    jest.spyOn(PlatformSettingsModel, 'findOneAndUpdate').mockImplementation((() =>
      lean({ key: 'platform', platformName: 'Brainbaseedu', supportEmail: 'support@brainbaseedu.com' })) as never);
    settingsService.invalidate();
    const s = await settingsService.get();
    expect(s.minAttendancePercent).toBe(83);
    expect(s.disconnectGraceMinutes).toBe(5);
  });

  describe('update validation', () => {
    beforeEach(() => {
      const stored = { key: 'platform', minClassDurationMinutes: 30, maxClassDurationMinutes: 90, featureFlags: {} };
      jest.spyOn(settingsService, 'get').mockImplementation(async () => stored as never);
      jest.spyOn(PlatformSettingsModel, 'findOneAndUpdate').mockImplementation(((_f: unknown, u: { $set: object }) =>
        lean({ ...stored, ...u.$set })) as never);
    });

    it.each([0, 101, -5])('rejects required attendance of %s', async (v) => {
      await expect(settingsService.update({ minAttendancePercent: v }, actor)).rejects.toThrow();
      expect(PlatformSettingsModel.findOneAndUpdate).not.toHaveBeenCalled();
    });
    it('rejects a grace above 60 minutes', async () => {
      await expect(settingsService.update({ disconnectGraceMinutes: 61 }, actor)).rejects.toThrow(/cannot exceed 60/);
    });
    it('accepts 100% and a zero grace', async () => {
      await expect(
        settingsService.update({ minAttendancePercent: 100, disconnectGraceMinutes: 0 }, actor),
      ).resolves.toMatchObject({ minAttendancePercent: 100, disconnectGraceMinutes: 0 });
    });
  });
});
