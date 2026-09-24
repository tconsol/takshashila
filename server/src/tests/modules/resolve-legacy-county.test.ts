import { resolveLegacyCounty } from '../../scripts/resolve-legacy-county';

describe('resolveLegacyCounty', () => {
  it('resolves a unique name with or without the suffix', () => {
    for (const raw of ['Wake', 'Wake County', '  wake county ']) {
      const r = resolveLegacyCounty(raw);
      expect(r).toEqual({ status: 'resolved', county: { fips: '37183', name: 'Wake County', state: 'NC' } });
    }
  });

  it('uses a trailing state code in the text', () => {
    const r = resolveLegacyCounty('Washington County, OR');
    expect(r.status).toBe('resolved');
    if (r.status === 'resolved') expect(r.county.state).toBe('OR');
  });

  it('reports names shared across states as ambiguous', () => {
    const r = resolveLegacyCounty('Washington County');
    expect(r.status).toBe('ambiguous');
    if (r.status === 'ambiguous') expect(r.candidates.length).toBeGreaterThan(20);
  });

  it('narrows with the state hint', () => {
    const r = resolveLegacyCounty('Washington', 'md');
    expect(r.status).toBe('resolved');
    if (r.status === 'resolved') expect(r.county.state).toBe('MD');
  });

  it('handles parishes and punctuation', () => {
    const r = resolveLegacyCounty('St. Tammany Parish');
    expect(r.status).toBe('resolved');
    if (r.status === 'resolved') expect(r.county.state).toBe('LA');
  });

  it('returns unmatched for unknown or empty text', () => {
    expect(resolveLegacyCounty('Narnia')).toEqual({ status: 'unmatched' });
    expect(resolveLegacyCounty('   ')).toEqual({ status: 'unmatched' });
  });
});
