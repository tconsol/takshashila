import { resolveCurriculumDistrict } from '../../scripts/resolve-curriculum-district';

describe('resolveCurriculumDistrict', () => {
  it('resolves a county that has exactly one district', () => {
    expect(resolveCurriculumDistrict('NC', '37183')).toEqual({
      status: 'resolved',
      district: { id: '3704720', name: 'Wake County Schools', state: 'NC', countyFips: '37183' },
    });
  });

  it('leaves a multi-district county unresolved with the candidate count', () => {
    const r = resolveCurriculumDistrict('CA', '06037');
    expect(r.status).toBe('unresolved');
    if (r.status === 'unresolved') expect(r.candidates).toBeGreaterThan(50);
  });

  it('leaves missing or unknown location unresolved', () => {
    expect(resolveCurriculumDistrict(undefined, '37183')).toEqual({ status: 'unresolved', candidates: 0 });
    expect(resolveCurriculumDistrict('ZZ', '37183')).toEqual({ status: 'unresolved', candidates: 0 });
  });
});
