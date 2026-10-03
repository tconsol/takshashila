// frontend/src/components/shared/StateCountyFields.tsx
//
// State and county dropdowns (no country, no school district). Used where someone fills in where a
// child goes to school: it decides which state curriculum and county programs the child sees.
import { Select } from '../ui/Select';
import { useUsStates, useUsCounties } from '../../hooks/use-geo';

export interface StateCounty { state: string; countyFips: string }

export function StateCountyFields({ value, onChange, disabled }: {
  value: StateCounty;
  onChange: (next: StateCounty) => void;
  disabled?: boolean;
}) {
  const { data: states = [] } = useUsStates();
  const { data: counties = [], isLoading } = useUsCounties(value.state || undefined);
  return (
    <div className="grid grid-cols-2 gap-3">
      <Select
        label="State"
        placeholder="Select state…"
        options={states.map((s) => ({ value: s.code, label: s.name }))}
        value={value.state}
        onChange={(e) => onChange({ state: e.target.value, countyFips: '' })}
        disabled={disabled}
      />
      <Select
        label="County"
        placeholder={!value.state ? 'Select a state first' : isLoading ? 'Loading…' : 'Select county…'}
        options={counties.map((c) => ({ value: c.fips, label: c.name }))}
        value={value.countyFips}
        onChange={(e) => onChange({ ...value, countyFips: e.target.value })}
        disabled={disabled || !value.state || isLoading}
      />
    </div>
  );
}
