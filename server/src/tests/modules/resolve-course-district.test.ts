import { resolveCourseDistrict } from '../../scripts/resolve-course-district';

describe('resolveCourseDistrict', () => {
  it('resolves a county that has exactly one district', () => {
    expect(resolveCourseDistrict('NC', '37183')).toEqual({
      status: 'resolved',
      district: { id: '3704720', name: 'Wake County Schools', state: 'NC', countyFips: '37183' },
    });
  });

  it('leaves a multi-district county unresolved with the candidate count', () => {
    const r = resolveCourseDistrict('CA', '06037');
    expect(r.status).toBe('unresolved');
    if (r.status === 'unresolved') expect(r.candidates).toBeGreaterThan(50);
  });

  it('leaves missing or unknown location unresolved', () => {
    expect(resolveCourseDistrict(undefined, '37183')).toEqual({ status: 'unresolved', candidates: 0 });
    expect(resolveCourseDistrict('ZZ', '37183')).toEqual({ status: 'unresolved', candidates: 0 });
  });
});
