// frontend/src/services/geo.service.ts
import { api } from '../lib/axios';

export interface Country { code: string; name: string }
export interface UsState { code: string; name: string }
export interface UsCounty { fips: string; name: string; state: string }

/** A course's or student's location. `countyFips` is the match key; `county` is the display name. */
export interface Location {
  country: string;
  state: string;
  countyFips: string;
}

export const geoService = {
  listCountries: (): Promise<Country[]> => api.get('/geo/countries').then((r) => r.data.data),
  listStates: (): Promise<UsState[]> => api.get('/geo/states').then((r) => r.data.data),
  listCounties: (stateCode: string): Promise<UsCounty[]> =>
    api.get(`/geo/states/${stateCode}/counties`).then((r) => r.data.data),
};
