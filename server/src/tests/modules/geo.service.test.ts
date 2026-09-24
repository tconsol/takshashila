import { geoService } from '../../modules/geo/geo.service';
import { courseLocationSchema, partialLocationSchema, districtIdSchema } from '../../modules/geo/geo.validators';

describe('GeoService', () => {
  it('lists the 50 states + DC', () => {
    const states = geoService.listStates();
    expect(states).toHaveLength(51);
    expect(states).toContainEqual({ code: 'NC', name: 'North Carolina' });
  });

  it('lists only the given state\'s counties, sorted by name', () => {
    const counties = geoService.listCounties('NC')!;
    expect(counties).toHaveLength(100);
    expect(counties.every((c) => c.state === 'NC')).toBe(true);
    expect(counties).toContainEqual({ fips: '37183', name: 'Wake County', state: 'NC' });
    const names = counties.map((c) => c.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('returns null for an unknown state and undefined for an unknown county', () => {
    expect(geoService.listCounties('ZZ')).toBeNull();
    expect(geoService.getCounty('99999')).toBeUndefined();
  });

  it('distinguishes same-named counties across states by FIPS', () => {
    expect(geoService.getCounty('51059')).toEqual({ fips: '51059', name: 'Fairfax County', state: 'VA' });
    expect(geoService.getCounty('41067')?.state).toBe('OR'); // Washington County, OR
    expect(geoService.getCounty('27163')?.state).toBe('MN'); // Washington County, MN
  });

  it('lists a state\'s districts sorted by name, optionally narrowed to a county', () => {
    const nc = geoService.listDistricts('NC')!;
    expect(nc.length).toBeGreaterThan(100);
    expect(nc.every((d) => d.state === 'NC')).toBe(true);
    const names = nc.map((d) => d.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));

    expect(geoService.listDistricts('NC', '37183')).toEqual([
      { id: '3704720', name: 'Wake County Schools', state: 'NC', countyFips: '37183' },
    ]);
    expect(geoService.listDistricts('CA', '06037')!.length).toBeGreaterThan(50);
  });

  it('returns null districts for an unknown state and finds districts by id (leading zeros kept)', () => {
    expect(geoService.listDistricts('ZZ')).toBeNull();
    expect(geoService.getDistrict('0100005')).toEqual(expect.objectContaining({ state: 'AL', name: 'Albertville City' }));
    expect(geoService.getDistrict('100005')).toBeUndefined();
  });
});

describe('districtIdSchema', () => {
  it('accepts a known district and rejects malformed or unknown ids', () => {
    expect(districtIdSchema.safeParse('3704720').success).toBe(true);
    expect(districtIdSchema.safeParse('37047').success).toBe(false);
    expect(districtIdSchema.safeParse('9999999').success).toBe(false);
  });
});

describe('location validators', () => {
  it('accepts a county that belongs to the given state, defaulting country to US', () => {
    const parsed = courseLocationSchema.parse({ state: 'NC', countyFips: '37183' });
    expect(parsed).toEqual({ country: 'US', state: 'NC', countyFips: '37183' });
  });

  it('rejects a county from a different state', () => {
    const result = courseLocationSchema.safeParse({ state: 'VA', countyFips: '37183' });
    expect(result.success).toBe(false);
    expect(result.success ? [] : result.error.flatten().fieldErrors.countyFips).toBeDefined();
  });

  it('rejects a non-US country and an unknown state', () => {
    expect(courseLocationSchema.safeParse({ country: 'CA', state: 'NC', countyFips: '37183' }).success).toBe(false);
    expect(courseLocationSchema.safeParse({ state: 'ZZ', countyFips: '37183' }).success).toBe(false);
  });

  it('partial: allows omitting location entirely, but not only one of state/countyFips', () => {
    expect(partialLocationSchema.safeParse({}).success).toBe(true);
    expect(partialLocationSchema.safeParse({ state: 'NC', countyFips: '37183' }).success).toBe(true);
    expect(partialLocationSchema.safeParse({ countyFips: '37183' }).success).toBe(false);
    expect(partialLocationSchema.safeParse({ state: 'NC' }).success).toBe(false);
  });
});
