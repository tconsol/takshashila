import usCounties from './us-counties.json';
import { US_STATES, COUNTRIES } from './us-states';

export interface UsCounty {
  fips: string;
  name: string;
  state: string;
}

/** Static US geography, loaded once. Data: US Census county gazetteer
 *  (regenerate with src/scripts/build-us-counties.ts). */
class GeoService {
  private readonly byFips = new Map<string, UsCounty>();
  private readonly byState = new Map<string, UsCounty[]>();

  constructor() {
    for (const c of usCounties as UsCounty[]) {
      this.byFips.set(c.fips, c);
      const list = this.byState.get(c.state) ?? [];
      list.push(c);
      this.byState.set(c.state, list);
    }
    for (const list of this.byState.values()) list.sort((a, b) => a.name.localeCompare(b.name));
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
}

export const geoService = new GeoService();
