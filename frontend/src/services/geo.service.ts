// frontend/src/services/geo.service.ts
import { api } from '../lib/axios';

export interface Country { code: string; name: string }
export interface UsState { code: string; name: string }
export interface UsCounty { fips: string; name: string; state: string }
export interface UsDistrict { id: string; name: string; state: string; countyFips: string }

/** A curriculum's or student's location. `districtId` (NCES LEAID) is the curriculum match key;
 *  county and state narrow the district list. Empty string = not chosen. */
export interface Location {
  country: string;
  state: string;
  countyFips: string;
  districtId: string;
}

export const geoService = {
  listCountries: (): Promise<Country[]> => api.get('/geo/countries').then((r) => r.data.data),
  listStates: (): Promise<UsState[]> => api.get('/geo/states').then((r) => r.data.data),
  listCounties: (stateCode: string): Promise<UsCounty[]> =>
    api.get(`/geo/states/${stateCode}/counties`).then((r) => r.data.data),
  listDistricts: (stateCode: string, countyFips: string): Promise<UsDistrict[]> =>
    api.get(`/geo/states/${stateCode}/districts`, { params: { countyFips } }).then((r) => r.data.data),
};
