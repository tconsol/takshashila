import { geoService } from './geo.service';
import { US_STATES } from './us-states';
import { ValidationError } from '../../utils/error';

export interface LocationUpdate {
  set: Record<string, unknown>;
  unset: Record<string, ''>;
}

/**
 * Turns a state and/or county chosen by someone on a student's behalf (a parent) into profile changes.
 * A county must belong to the state; changing the state clears a county that no longer fits, and picking a
 * county clears any old school district (a district belongs to one county).
 * `state: ''` clears the location.
 */
export function buildLocationUpdate(input: { state?: string; countyFips?: string }, currentState?: string): LocationUpdate {
  const set: Record<string, unknown> = {};
  const unset: Record<string, ''> = {};

  if (input.countyFips) {
    const county = geoService.getCounty(input.countyFips);
    if (!county) throw new ValidationError({ countyFips: [`Unknown county ${input.countyFips}`] });
    const state = input.state || currentState;
    if (state && county.state !== state) throw new ValidationError({ countyFips: ['This county is not in the selected state'] });
    Object.assign(set, { country: 'US', state: county.state, countyFips: county.fips, county: county.name });
    Object.assign(unset, { districtId: '', district: '' });
  } else if (input.state === '') {
    Object.assign(unset, { state: '', countyFips: '', county: '', districtId: '', district: '' });
  } else if (input.state) {
    if (!US_STATES.some((s) => s.code === input.state)) throw new ValidationError({ state: [`Unknown state ${input.state}`] });
    set.country = 'US';
    set.state = input.state;
    if (input.state !== currentState) Object.assign(unset, { countyFips: '', county: '', districtId: '', district: '' });
  }
  return { set, unset };
}
