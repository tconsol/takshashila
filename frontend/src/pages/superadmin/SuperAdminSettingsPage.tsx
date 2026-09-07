import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Settings as SettingsIcon, AlertTriangle, ToggleLeft } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import {
  systemService, FEATURE_FLAG_LABELS, type PlatformSettings,
} from '../../services/system.service';

type FieldKey = keyof Omit<PlatformSettings, 'updatedAt' | 'updatedBy'>;

interface SettingField {
  label: string;
  key: FieldKey;
  type?: 'text' | 'email' | 'number';
  hint?: string;
  /** Stored in cents, edited in whole currency units. */
  centsField?: boolean;
}

interface SettingSection {
  title: string;
  description: string;
  fields: SettingField[];
}

const SECTIONS: SettingSection[] = [
  {
    title: 'Platform',
    description: 'General platform configuration',
    fields: [
      { label: 'Platform Name', key: 'platformName' },
      { label: 'Support Email', key: 'supportEmail', type: 'email' },
    ],
  },
  {
    title: 'Commission & Pricing',
    description: 'Defaults applied when a new tutor or principal profile is created',
    fields: [
      { label: 'Default Tutor Commission (%)', key: 'defaultTutorCommissionRatePercent', type: 'number' },
      { label: 'Default Principal Commission (%)', key: 'defaultPrincipalCommissionRatePercent', type: 'number' },
      { label: 'Demo Class Credit (USD)', key: 'demoCreditCents', type: 'number', centsField: true },
      { label: 'Max Demo Classes per Student', key: 'maxDemoClasses', type: 'number' },
    ],
  },
  {
    title: 'Session Limits',
    description: 'Constraints on scheduling and booking',
    fields: [
      { label: 'Max Advance Booking Days', key: 'maxAdvanceBookingDays', type: 'number' },
      { label: 'Min Class Duration (minutes)', key: 'minClassDurationMinutes', type: 'number' },
      { label: 'Max Class Duration (minutes)', key: 'maxClassDurationMinutes', type: 'number' },
    ],
  },
];

const ALL_FIELDS = SECTIONS.flatMap((s) => s.fields);

/** Server stores money in cents; the form edits whole units. */
function toFormValues(settings: PlatformSettings): Record<string, string> {
  return Object.fromEntries(
    ALL_FIELDS.map((f) => {
      const raw = settings[f.key];
      return [f.key, f.centsField ? String(Number(raw) / 100) : String(raw ?? '')];
    }),
  );
}

function toPatch(values: Record<string, string>): Partial<PlatformSettings> {
  const patch: Record<string, string | number> = {};
  for (const f of ALL_FIELDS) {
    const v = values[f.key];
    if (v === undefined || v === '') continue;
    if (f.type === 'number') {
      patch[f.key] = f.centsField ? Math.round(Number(v) * 100) : Number(v);
    } else {
      patch[f.key] = v;
    }
  }
  return patch as Partial<PlatformSettings>;
}

function Toggle({
  checked, onChange, label, description, danger,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description: string;
  danger?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-slate-100 p-4 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">{label}</p>
        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
          checked
            ? danger ? 'bg-rose-500' : 'bg-emerald-500'
            : 'bg-slate-300 dark:bg-slate-700'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </button>
    </label>
  );
}

export function SuperAdminSettingsPage() {
  const qc = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const [maintenance, setMaintenance] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);

  const { data: settings, isLoading, isError } = useQuery({
    queryKey: ['platform-settings'],
    queryFn: systemService.getPlatformSettings,
    staleTime: 60_000,
  });

  // Seed the form once the saved settings arrive.
  useEffect(() => {
    if (!settings) return;
    setValues(toFormValues(settings));
    setMaintenance(!!settings.maintenanceMode);
    setMaintenanceMessage(settings.maintenanceMessage ?? '');
    setFlags({ ...settings.featureFlags });
  }, [settings]);

  const { mutate: save, isPending, error: saveError } = useMutation({
    mutationFn: () => systemService.updatePlatformSettings({
      ...toPatch(values),
      maintenanceMode: maintenance,
      maintenanceMessage: maintenanceMessage.trim() || undefined,
      featureFlags: flags,
    } as Partial<PlatformSettings>),
    onSuccess: (updated) => {
      qc.setQueryData(['platform-settings'], updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const dirty = settings
    ? JSON.stringify(values) !== JSON.stringify(toFormValues(settings))
      || maintenance !== !!settings.maintenanceMode
      || maintenanceMessage !== (settings.maintenanceMessage ?? '')
      || JSON.stringify(flags) !== JSON.stringify(settings.featureFlags ?? {})
    : false;

  const flagKeys = Object.keys(FEATURE_FLAG_LABELS);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Platform-wide configuration"
        icon={<SettingsIcon className="h-5 w-5" />}
        actions={
          <div className="flex items-center gap-3">
            {settings?.updatedAt && (
              <span className="text-xs text-slate-400">
                Last saved {new Date(settings.updatedAt).toLocaleString()}
              </span>
            )}
            <Button onClick={() => save()} loading={isPending} disabled={!dirty && !saved}>
              {saved ? '✓ Saved' : 'Save Changes'}
            </Button>
          </div>
        }
      />

      {isError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600 dark:border-rose-800 dark:bg-rose-900/20">
          Failed to load platform settings.
        </div>
      )}
      {saveError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600 dark:border-rose-800 dark:bg-rose-900/20">
          {(saveError as Error).message}
        </div>
      )}

      {/* Maintenance mode */}
      <div className={`rounded-xl border ${maintenance ? 'border-rose-300 dark:border-rose-800' : 'border-gray-200 dark:border-gray-700'} bg-white dark:bg-gray-800`}>
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <AlertTriangle className={`h-4 w-4 ${maintenance ? 'text-rose-500' : 'text-slate-400'}`} />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Maintenance Mode</h3>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                Blocks write requests for everyone except admins. Reads stay available.
              </p>
            </div>
          </div>
          {maintenance && <Badge variant="danger" tone="soft" dot>Active</Badge>}
        </div>
        <div className="space-y-4 px-6 py-5">
          <Toggle
            checked={maintenance}
            onChange={setMaintenance}
            danger
            label="Enable maintenance mode"
            description="Non-admin POST, PATCH and DELETE requests will receive a 503 with the message below."
          />
          <Input
            label="Message shown to users"
            value={maintenanceMessage}
            onChange={(e) => setMaintenanceMessage(e.target.value)}
          />
        </div>
      </div>

      {/* Feature flags */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center gap-2 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <ToggleLeft className="h-4 w-4 text-slate-400" />
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Feature Flags</h3>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              Turn platform capabilities on or off without a deploy.
            </p>
          </div>
        </div>
        <div className="grid gap-3 px-6 py-5 md:grid-cols-2">
          {flagKeys.map((key) => (
            <Toggle
              key={key}
              checked={flags[key] ?? true}
              onChange={(next) => setFlags((f) => ({ ...f, [key]: next }))}
              label={FEATURE_FLAG_LABELS[key].label}
              description={FEATURE_FLAG_LABELS[key].description}
            />
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {SECTIONS.map((section) => (
          <div key={section.title} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">{section.title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{section.description}</p>
            </div>
            <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-5">
              {section.fields.map((field) => (
                <Input
                  key={field.key}
                  label={field.label}
                  type={field.type ?? 'text'}
                  value={values[field.key] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
