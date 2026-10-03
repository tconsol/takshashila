import { buildLocationUpdate } from '../../modules/geo/location-update';
import { updateChildByParentSchema, createStudentByParentSchema } from '../../modules/students/student.validators';

describe('buildLocationUpdate', () => {
  it('a county sets state, name and country, and clears the old school district', () => {
    const { set, unset } = buildLocationUpdate({ countyFips: '08031' });
    expect(set).toEqual({ country: 'US', state: 'CO', countyFips: '08031', county: 'Denver County' });
    expect(unset).toEqual({ districtId: '', district: '' });
  });

  it('refuses a county that is not in the stated state', () => {
    expect(() => buildLocationUpdate({ state: 'GA', countyFips: '08031' })).toThrow();
    expect(() => buildLocationUpdate({ countyFips: '08031' }, 'GA')).toThrow();
    expect(() => buildLocationUpdate({ countyFips: '99999' })).toThrow();
  });

  it('a new state clears a county that no longer fits, the same state keeps it', () => {
    expect(buildLocationUpdate({ state: 'GA' }, 'CO').unset).toMatchObject({ countyFips: '', county: '' });
    expect(buildLocationUpdate({ state: 'CO' }, 'CO').unset).toEqual({});
  });

  it('an empty state clears the whole location', () => {
    expect(Object.keys(buildLocationUpdate({ state: '' }, 'CO').unset)).toEqual(expect.arrayContaining(['state', 'countyFips', 'county']));
  });

  it('rejects an unknown state', () => {
    expect(() => buildLocationUpdate({ state: 'ZZ' })).toThrow();
  });
});

describe('parent child schemas', () => {
  it('accepts a state and county, upper-cases the state, and rejects a bad county code', () => {
    expect(updateChildByParentSchema.parse({ state: 'co', countyFips: '08031' })).toMatchObject({ state: 'CO', countyFips: '08031' });
    expect(updateChildByParentSchema.safeParse({ countyFips: '8031' }).success).toBe(false);
    expect(updateChildByParentSchema.parse({ state: '' }).state).toBe('');
  });
  it('ignores fields a parent may not change', () => {
    expect(updateChildByParentSchema.parse({ grade: 'Grade 3', status: 'ACTIVE', tutorPublicId: 'x' })).toEqual({ grade: 'Grade 3' });
  });
  it('lets a parent give a state and county when creating a child', () => {
    const base = { firstName: 'A', lastName: 'B', password: 'longenough', guardianConsent: true as const };
    expect(createStudentByParentSchema.parse({ ...base, state: 'co', countyFips: '08031' })).toMatchObject({ state: 'CO', countyFips: '08031' });
  });
});

describe('creating a child with a bad county', () => {
  it('is refused before any user account is created', async () => {
    const { studentService } = await import('../../modules/students/student.service');
    const { userRepository } = await import('../../modules/users/user.repository');
    const create = jest.spyOn(userRepository, 'create');
    await expect(
      studentService.createByParent('parent-1', { firstName: 'A', lastName: 'B', password: 'longenough', guardianConsent: true, state: 'GA', countyFips: '08031' } as never),
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(create).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });
});
