import { geoService, type UsDistrict } from '../modules/geo/geo.service';

export type DistrictResolution =
  | { status: 'resolved'; district: UsDistrict }
  | { status: 'unresolved'; candidates: number };

/** A county-scoped course can only be moved to a district automatically when
 *  its county has exactly one district. */
export function resolveCourseDistrict(state?: string, countyFips?: string): DistrictResolution {
  if (!state || !countyFips) return { status: 'unresolved', candidates: 0 };
  const districts = geoService.listDistricts(state, countyFips) ?? [];
  return districts.length === 1
    ? { status: 'resolved', district: districts[0] }
    : { status: 'unresolved', candidates: districts.length };
}
