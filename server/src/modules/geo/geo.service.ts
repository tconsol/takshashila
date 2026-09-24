import usCounties from './us-counties.json';
import usDistricts from './us-districts.json';
import { US_STATES, COUNTRIES } from './us-states';

export interface UsCounty {
  fips: string;
  name: string;
  state: string;
}

/** NCES school district; `id` is the 7-digit LEAID (string — leading zeros matter). */
export interface UsDistrict {
  id: string;
  name: string;
  state: string;
  countyFips: string;
}

/** Static US geography, loaded once. Data: US Census county gazetteer
 *  (regenerate with src/scripts/build-us-counties.ts) and NCES districts
 *  (regenerate with src/scripts/build-us-districts.ts). */
class GeoService {
  private readonly byFips = new Map<string, UsCounty>();
  private readonly byState = new Map<string, UsCounty[]>();
  private readonly districtById = new Map<string, UsDistrict>();
  private readonly districtsByState = new Map<string, UsDistrict[]>();

  constructor() {
    for (const c of usCounties as UsCounty[]) {
      this.byFips.set(c.fips, c);
      const list = this.byState.get(c.state) ?? [];
      list.push(c);
      this.byState.set(c.state, list);
    }
    for (const list of this.byState.values()) list.sort((a, b) => a.name.localeCompare(b.name));

    for (const d of usDistricts as UsDistrict[]) {
      this.districtById.set(d.id, d);
      const list = this.districtsByState.get(d.state) ?? [];
      list.push(d);
      this.districtsByState.set(d.state, list);
    }
    for (const list of this.districtsByState.values()) list.sort((a, b) => a.name.localeCompare(b.name));
  }

  listCountries() {
    return COUNTRIES.map((c) => ({ ...c }));
  }

  listStates() {
    return US_STATES.map((s) => ({ ...s }));
  }

  /** null when the state code is unknown. */
  listCounties(stateCode: string): UsCounty[] | null {
    if (!US_STATES.some((s) => s.code === stateCode)) return null;
    return this.byState.get(stateCode) ?? [];
  }

  getCounty(fips: string): UsCounty | undefined {
    return this.byFips.get(fips);
  }

  /** null when the state code is unknown. */
  listDistricts(stateCode: string, countyFips?: string): UsDistrict[] | null {
    if (!US_STATES.some((s) => s.code === stateCode)) return null;
    const list = this.districtsByState.get(stateCode) ?? [];
    return countyFips ? list.filter((d) => d.countyFips === countyFips) : list;
  }

  getDistrict(id: string): UsDistrict | undefined {
    return this.districtById.get(id);
  }
}

export const geoService = new GeoService();
