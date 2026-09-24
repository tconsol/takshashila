// frontend/src/hooks/use-geo.ts
import { useQuery } from '@tanstack/react-query';
import { geoService } from '../services/geo.service';

// Static reference data — fetch once per session.
const STATIC = { staleTime: Infinity, gcTime: Infinity } as const;

export const geoKeys = {
  countries: ['geo', 'countries'] as const,
  states: ['geo', 'states'] as const,
  counties: (state: string) => ['geo', 'counties', state] as const,
  districts: (state: string, county: string) => ['geo', 'districts', state, county] as const,
};

export function useCountries() {
  return useQuery({ queryKey: geoKeys.countries, queryFn: geoService.listCountries, ...STATIC });
}

export function useUsStates() {
  return useQuery({ queryKey: geoKeys.states, queryFn: geoService.listStates, ...STATIC });
}

export function useUsCounties(stateCode: string | undefined) {
  return useQuery({
    queryKey: geoKeys.counties(stateCode ?? ''),
    queryFn: () => geoService.listCounties(stateCode!),
    enabled: !!stateCode,
    ...STATIC,
  });
}

export function useUsDistricts(stateCode: string | undefined, countyFips: string | undefined) {
  return useQuery({
    queryKey: geoKeys.districts(stateCode ?? '', countyFips ?? ''),
    queryFn: () => geoService.listDistricts(stateCode!, countyFips!),
    enabled: !!stateCode && !!countyFips,
    ...STATIC,
  });
}
