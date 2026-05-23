import { useState } from 'react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

interface SettingSection {
  title: string;
  description: string;
  fields: { label: string; key: string; type?: string; placeholder?: string }[];
}

const SECTIONS: SettingSection[] = [
  {
    title: 'Platform',
    description: 'General platform configuration',
    fields: [
      { label: 'Platform Name', key: 'platformName', placeholder: 'Takshashila' },
      { label: 'Support Email', key: 'supportEmail', type: 'email', placeholder: 'support@takshashila.com' },
    ],
  },
  {
    title: 'Commission & Pricing',
    description: 'Default commission rates applied to tutor earnings',
    fields: [
      { label: 'Default Commission Rate (%)', key: 'defaultCommissionRate', type: 'number', placeholder: '20' },
      { label: 'Demo Class Credit (USD)', key: 'demoCreditAmount', type: 'number', placeholder: '100' },
      { label: 'Max Demo Classes per Student', key: 'maxDemoClasses', type: 'number', placeholder: '3' },
    ],
  },
  {
    title: 'Session Limits',
    description: 'Constraints on scheduling and booking',
    fields: [
      { label: 'Max Advance Booking Days', key: 'maxAdvanceBookingDays', type: 'number', placeholder: '30' },
      { label: 'Min Class Duration (minutes)', key: 'minClassDuration', type: 'number', placeholder: '30' },
      { label: 'Max Class Duration (minutes)', key: 'maxClassDuration', type: 'number', placeholder: '180' },
    ],
  },
];

export function SuperAdminSettingsPage() {
  const [saved, setSaved] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({
    platformName: 'Takshashila',
    supportEmail: 'support@takshashila.com',
    defaultCommissionRate: '20',
    demoCreditAmount: '100',
    maxDemoClasses: '3',
    maxAdvanceBookingDays: '30',
    minClassDuration: '30',
    maxClassDuration: '180',
  });

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Settings" description="Platform-wide configuration" />
        <Button onClick={handleSave}>
          {saved ? '✓ Saved' : 'Save Changes'}
        </Button>
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
                  placeholder={field.placeholder}
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
