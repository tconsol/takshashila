// frontend/src/components/shared/LocationSelect.tsx
//
// Country → State → County dropdowns. Renders three sibling fields so the
// caller's grid decides the layout. Changing the state clears the county,
// because a county only makes sense inside its state.
import { Select } from '../ui/Select';
import { useCountries, useUsStates, useUsCounties } from '../../hooks/use-geo';
import type { Location } from '../../services/geo.service';

interface LocationSelectProps {
  value: Location;
  onChange: (next: Location) => void;
  errors?: Partial<Record<keyof Location, string>>;
  disabled?: boolean;
}

export const EMPTY_LOCATION: Location = { country: 'US', state: '', countyFips: '' };

export function LocationSelect({ value, onChange, errors, disabled }: LocationSelectProps) {
  const { data: countries = [] } = useCountries();
  const { data: states = [] } = useUsStates();
  const { data: counties = [], isLoading: countiesLoading } = useUsCounties(value.state || undefined);

  return (
    <>
      <Select
        label="Country"
        options={countries.map((c) => ({ value: c.code, label: c.name }))}
        placeholder="Select country"
        value={value.country}
        onChange={(e) => onChange({ country: e.target.value, state: '', countyFips: '' })}
        error={errors?.country}
        disabled={disabled}
      />
      <Select
        label="State"
        options={states.map((s) => ({ value: s.code, label: s.name }))}
        placeholder="Select state"
        value={value.state}
        onChange={(e) => onChange({ ...value, state: e.target.value, countyFips: '' })}
        error={errors?.state}
        disabled={disabled || !value.country}
      />
      <Select
        label="County"
        options={counties.map((c) => ({ value: c.fips, label: c.name }))}
        placeholder={!value.state ? 'Select a state first' : countiesLoading ? 'Loading counties…' : 'Select county'}
        value={value.countyFips}
        onChange={(e) => onChange({ ...value, countyFips: e.target.value })}
        error={errors?.countyFips}
        disabled={disabled || !value.state || countiesLoading}
      />
    </>
  );
}
