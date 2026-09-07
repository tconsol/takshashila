import mongoose, { Schema } from 'mongoose';

/**
 * Singleton document holding platform-wide configuration. Exactly one row is
 * ever created, keyed by `key: 'platform'`, so reads are a single indexed hit.
 */
export interface IPlatformSettings {
  _id: string;
  key: 'platform';

  platformName: string;
  supportEmail: string;

  defaultTutorCommissionRatePercent: number;
  defaultPrincipalCommissionRatePercent: number;
  demoCreditCents: number;
  maxDemoClasses: number;

  maxAdvanceBookingDays: number;
  minClassDurationMinutes: number;
  maxClassDurationMinutes: number;

  maintenanceMode: boolean;
  maintenanceMessage: string;
  featureFlags: Record<string, boolean>;

  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Flags ship here with their default so the console can render every switch even
 * before anyone has toggled one. Adding a key makes the flag appear; the runtime
 * reads it through `settingsService.isFeatureEnabled`.
 */
export const FEATURE_FLAG_DEFAULTS: Record<string, boolean> = {
  registrationOpen: true,
  classBookingEnabled: true,
  payoutsEnabled: true,
  chatEnabled: true,
  gamesEnabled: true,
};

export const PLATFORM_SETTINGS_DEFAULTS = {
  platformName: 'Takshashila',
  supportEmail: 'support@takshashila.com',
  defaultTutorCommissionRatePercent: 20,
  defaultPrincipalCommissionRatePercent: 15,
  demoCreditCents: 100_00,
  maxDemoClasses: 3,
  maxAdvanceBookingDays: 30,
  minClassDurationMinutes: 30,
  maxClassDurationMinutes: 180,
  maintenanceMode: false,
  maintenanceMessage: 'The platform is briefly down for maintenance. Please try again shortly.',
} as const;

const platformSettingsSchema = new Schema<IPlatformSettings>(
  {
    key: { type: String, default: 'platform', unique: true, index: true },

    platformName: { type: String, default: PLATFORM_SETTINGS_DEFAULTS.platformName, trim: true },
    supportEmail: { type: String, default: PLATFORM_SETTINGS_DEFAULTS.supportEmail, trim: true, lowercase: true },

    defaultTutorCommissionRatePercent: {
      type: Number, default: PLATFORM_SETTINGS_DEFAULTS.defaultTutorCommissionRatePercent, min: 0, max: 100,
    },
    defaultPrincipalCommissionRatePercent: {
      type: Number, default: PLATFORM_SETTINGS_DEFAULTS.defaultPrincipalCommissionRatePercent, min: 0, max: 100,
    },
    demoCreditCents: { type: Number, default: PLATFORM_SETTINGS_DEFAULTS.demoCreditCents, min: 0 },
    maxDemoClasses: { type: Number, default: PLATFORM_SETTINGS_DEFAULTS.maxDemoClasses, min: 0, max: 50 },

    maxAdvanceBookingDays: { type: Number, default: PLATFORM_SETTINGS_DEFAULTS.maxAdvanceBookingDays, min: 1, max: 365 },
    minClassDurationMinutes: { type: Number, default: PLATFORM_SETTINGS_DEFAULTS.minClassDurationMinutes, min: 5, max: 600 },
    maxClassDurationMinutes: { type: Number, default: PLATFORM_SETTINGS_DEFAULTS.maxClassDurationMinutes, min: 5, max: 600 },

    maintenanceMode: { type: Boolean, default: PLATFORM_SETTINGS_DEFAULTS.maintenanceMode },
    maintenanceMessage: { type: String, default: PLATFORM_SETTINGS_DEFAULTS.maintenanceMessage },
    featureFlags: { type: Schema.Types.Mixed, default: () => ({ ...FEATURE_FLAG_DEFAULTS }) },

    updatedBy: { type: String },
  },
  { timestamps: true },
);

export const PlatformSettingsModel = mongoose.model<IPlatformSettings>(
  'PlatformSettings',
  platformSettingsSchema,
);
