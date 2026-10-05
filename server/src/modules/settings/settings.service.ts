import { PlatformSettingsModel, PLATFORM_SETTINGS_DEFAULTS, FEATURE_FLAG_DEFAULTS } from './settings.model';
import type { IPlatformSettings } from './settings.model';
import { auditService } from '../audit/audit.service';
import { ValidationError } from '../../utils/error';
import type { Role } from '../../constants/roles';

export type PlatformSettingsDto = Omit<
  IPlatformSettings,
  '_id' | 'key' | 'createdAt' | 'updatedAt' | 'updatedBy'
>;

const EDITABLE_KEYS = Object.keys(PLATFORM_SETTINGS_DEFAULTS) as (keyof PlatformSettingsDto)[];

const BOOLEAN_KEYS: (keyof PlatformSettingsDto)[] = ['maintenanceMode'];

const ARRAY_KEYS: (keyof PlatformSettingsDto)[] = ['enabledSubjects'];

const NUMERIC_KEYS: (keyof PlatformSettingsDto)[] = [
  'defaultTutorCommissionRatePercent',
  'defaultPrincipalCommissionRatePercent',
  'demoCreditCents',
  'maxDemoClasses',
  'minAttendancePercent',
  'disconnectGraceMinutes',
  'maxAdvanceBookingDays',
  'minClassDurationMinutes',
  'maxClassDurationMinutes',
];

/** Settings are read on hot paths, so keep a short-lived in-process copy. */
const CACHE_TTL_MS = 60_000;
let cached: { value: IPlatformSettings; expiresAt: number } | null = null;

// ValidationError takes the error list first; surface the same text as the message
// so the client sees something useful instead of the generic "Validation failed".
const invalid = (msg: string) => new ValidationError([msg], msg);

export class SettingsService {
  /** Reads the singleton, creating it with defaults on first access. */
  async get(): Promise<IPlatformSettings> {
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const doc = await PlatformSettingsModel.findOneAndUpdate(
      { key: 'platform' },
      { $setOnInsert: { key: 'platform', ...PLATFORM_SETTINGS_DEFAULTS } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();

    // Databases created before the rename still hold the old product name and
    // support address as if they were defaults; replace only those exact
    // legacy values, never anything an admin typed.
    if (doc && (doc.platformName === 'Takshashila' || doc.supportEmail === 'support@takshashila.com')) {
      const fix: Record<string, string> = {};
      if (doc.platformName === 'Takshashila') fix.platformName = PLATFORM_SETTINGS_DEFAULTS.platformName;
      if (doc.supportEmail === 'support@takshashila.com') fix.supportEmail = PLATFORM_SETTINGS_DEFAULTS.supportEmail;
      await PlatformSettingsModel.updateOne({ key: 'platform' }, { $set: fix });
      Object.assign(doc, fix);
    }

    // The settings row is created once; fields added later are absent on it, so read them as defaults.
    if (doc) {
      doc.minAttendancePercent ??= PLATFORM_SETTINGS_DEFAULTS.minAttendancePercent;
      doc.disconnectGraceMinutes ??= PLATFORM_SETTINGS_DEFAULTS.disconnectGraceMinutes;
    }

    cached = { value: doc as IPlatformSettings, expiresAt: Date.now() + CACHE_TTL_MS };
    return cached.value;
  }

  async update(
    patch: Partial<PlatformSettingsDto>,
    actor: { publicId: string; role: Role; ip?: string; userAgent?: string },
  ): Promise<IPlatformSettings> {
    const updates: Partial<PlatformSettingsDto> = {};

    for (const key of EDITABLE_KEYS) {
      if (patch[key] === undefined) continue;

      if (ARRAY_KEYS.includes(key)) {
        const v = patch[key];
        if (!Array.isArray(v) || v.some((x) => typeof x !== 'string' || !x.trim())) {
          throw invalid(`${key} must be a list of non-empty strings`);
        }
        (updates as Record<string, unknown>)[key] = [...new Set((v as string[]).map((x) => x.trim()))];
      } else if (BOOLEAN_KEYS.includes(key)) {
        (updates as Record<string, unknown>)[key] = patch[key] === true || patch[key] === 'true';
      } else if (NUMERIC_KEYS.includes(key)) {
        const n = Number(patch[key]);
        if (!Number.isFinite(n) || n < 0) throw invalid(`${key} must be a non-negative number`);
        (updates as Record<string, unknown>)[key] = n;
      } else {
        const s = String(patch[key]).trim();
        if (!s) throw invalid(`${key} cannot be empty`);
        (updates as Record<string, unknown>)[key] = s;
      }
    }

    // Flags arrive as a partial map and are merged onto what is stored, so toggling
    // one switch never silently resets the others.
    if (patch.featureFlags && typeof patch.featureFlags === 'object') {
      const current = await this.get();
      const merged: Record<string, boolean> = { ...FEATURE_FLAG_DEFAULTS, ...(current.featureFlags ?? {}) };
      for (const [name, value] of Object.entries(patch.featureFlags as Record<string, unknown>)) {
        if (!(name in FEATURE_FLAG_DEFAULTS)) throw invalid(`Unknown feature flag "${name}"`);
        merged[name] = value === true || value === 'true';
      }
      (updates as Record<string, unknown>).featureFlags = merged;
    }

    if (Object.keys(updates).length === 0) throw invalid('No valid settings supplied');

    if (updates.minAttendancePercent !== undefined && (updates.minAttendancePercent < 1 || updates.minAttendancePercent > 100)) {
      throw invalid('minAttendancePercent must be between 1 and 100');
    }
    if (updates.disconnectGraceMinutes !== undefined && updates.disconnectGraceMinutes > 60) {
      throw invalid('disconnectGraceMinutes cannot exceed 60');
    }

    const before = await this.get();

    // Validate against the resulting full state, not just this patch.
    const min = updates.minClassDurationMinutes ?? before.minClassDurationMinutes;
    const max = updates.maxClassDurationMinutes ?? before.maxClassDurationMinutes;
    if (min !== undefined && max !== undefined && min > max) {
      throw invalid('minClassDurationMinutes cannot exceed maxClassDurationMinutes');
    }

    const after = await PlatformSettingsModel.findOneAndUpdate(
      { key: 'platform' },
      { $set: { ...updates, updatedBy: actor.publicId } },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true },
    ).lean();

    cached = { value: after as IPlatformSettings, expiresAt: Date.now() + CACHE_TTL_MS };

    await auditService.log({
      actorId: actor.publicId,
      actorRole: actor.role,
      action: 'PLATFORM_SETTINGS_UPDATED',
      resourceType: 'PlatformSettings',
      resourceId: 'platform',
      ip: actor.ip,
      userAgent: actor.userAgent,
      before,
      after,
    });

    return cached.value;
  }

  /** Unknown flags read as enabled — a missing switch must not disable a feature. */
  async isFeatureEnabled(name: keyof typeof FEATURE_FLAG_DEFAULTS | string): Promise<boolean> {
    const settings = await this.get();
    const stored = settings.featureFlags?.[name];
    if (typeof stored === 'boolean') return stored;
    return FEATURE_FLAG_DEFAULTS[name] ?? true;
  }

  /** Drops the cache mid-TTL — used by tests and after a direct DB edit. */
  invalidate(): void {
    cached = null;
  }
}

export const settingsService = new SettingsService();
