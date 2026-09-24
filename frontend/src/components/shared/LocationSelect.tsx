// frontend/src/components/shared/LocationSelect.tsx
//
// Country → State → County → School district dropdowns. Renders four sibling
// fields so the caller's grid decides the layout. Changing a level clears the
// levels below it, because each only makes sense inside its parent.
import { Select } from '../ui/Select';
import { useCountries, useUsStates, useUsCounties, useUsDistricts } from '../../hooks/use-geo';
import type { Location } from '../../services/geo.service';

interface LocationSelectProps {
  value: Location;
  onChange: (next: Location) => void;
  errors?: Partial<Record<keyof Location, string>>;
  disabled?: boolean;
  /** Curricula need a district; the student profile treats it as optional. */
  requireDistrict?: boolean;
}

export const EMPTY_LOCATION: Location = { country: 'US', state: '', countyFips: '', districtId: '' };

export function LocationSelect({ value, onChange, errors, disabled, requireDistrict }: LocationSelectProps) {
  const { data: countries = [] } = useCountries();
  const { data: states = [] } = useUsStates();
  const { data: counties = [], isLoading: countiesLoading } = useUsCounties(value.state || undefined);
  const { data: districts = [], isLoading: districtsLoading } = useUsDistricts(
    value.state || undefined,
    value.countyFips || undefined,
  );

  const districtPlaceholder = !value.countyFips
    ? 'Select a county first'
    : districtsLoading
      ? 'Loading districts…'
      : districts.length === 0
        ? 'No districts listed for this county'
        : 'Select district';

  return (
    <>
      <Select
        label="Country"
        options={countries.map((c) => ({ value: c.code, label: c.name }))}
        placeholder="Select country"
        value={value.country}
        onChange={(e) => onChange({ country: e.target.value, state: '', countyFips: '', districtId: '' })}
        error={errors?.country}
        disabled={disabled}
      />
      <Select
        label="State"
        options={states.map((s) => ({ value: s.code, label: s.name }))}
        placeholder="Select state"
        value={value.state}
        onChange={(e) => onChange({ ...value, state: e.target.value, countyFips: '', districtId: '' })}
        error={errors?.state}
        disabled={disabled || !value.country}
      />
      <Select
        label="County"
        options={counties.map((c) => ({ value: c.fips, label: c.name }))}
        placeholder={!value.state ? 'Select a state first' : countiesLoading ? 'Loading counties…' : 'Select county'}
        value={value.countyFips}
        onChange={(e) => onChange({ ...value, countyFips: e.target.value, districtId: '' })}
        error={errors?.countyFips}
        disabled={disabled || !value.state || countiesLoading}
      />
      <div>
        <Select
          label={requireDistrict ? 'School district' : 'School district (optional)'}
          options={districts.map((d) => ({ value: d.id, label: d.name }))}
          placeholder={districtPlaceholder}
          value={value.districtId}
          onChange={(e) => onChange({ ...value, districtId: e.target.value })}
          error={errors?.districtId}
          disabled={disabled || !value.countyFips || districtsLoading || districts.length === 0}
        />
        {value.countyFips && !districtsLoading && (
          // NCES lists each district under one county, so a district that crosses a
          // county line only appears under its home county.
          <p className="mt-1 text-xs text-ink-muted">Don't see your district? It may be listed under a neighbouring county.</p>
        )}
      </div>
    </>
  );
}
