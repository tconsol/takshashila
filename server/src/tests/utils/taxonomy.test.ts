import {
  normalizeSubject,
  normalizeLanguage,
  normalizeSubjects,
  normalizeLanguages,
} from '../../utils/taxonomy';

describe('normalizeSubject', () => {
  it('folds the ways people write the same subject onto one name', () => {
    for (const variant of ['math', 'maths', 'MATHS', '  Mathematics  ', 'Math']) {
      expect(normalizeSubject(variant)).toBe('Mathematics');
    }
  });

  it('title-cases a subject it has never seen', () => {
    expect(normalizeSubject('vedic  astrology')).toBe('Vedic Astrology');
    expect(normalizeSubject('HISTORY')).toBe('History');
  });

  it('keeps minor words lowercase inside a name', () => {
    expect(normalizeSubject('history of art')).toBe('History of Art');
  });

  it('preserves an acronym the tutor typed in caps', () => {
    expect(normalizeSubject('IB Physics')).toBe('IB Physics');
  });

  it('treats punctuation as a word separator', () => {
    expect(normalizeSubject('computer/science')).toBe('Computer Science');
  });

  it('returns empty for blank input so it can be dropped', () => {
    expect(normalizeSubject('   ')).toBe('');
  });
});

describe('normalizeLanguage', () => {
  it('expands short codes', () => {
    expect(normalizeLanguage('tel')).toBe('Telugu');
    expect(normalizeLanguage('HIN')).toBe('Hindi');
  });

  it('title-cases an unknown language', () => {
    expect(normalizeLanguage('swahili')).toBe('Swahili');
  });
});

describe('list normalisation', () => {
  it('de-duplicates variants that collapse to the same name', () => {
    expect(normalizeSubjects(['math', 'Maths', 'MATHEMATICS'])).toEqual(['Mathematics']);
  });

  it('drops blank entries rather than storing empty strings', () => {
    expect(normalizeSubjects(['Physics', '', '   '])).toEqual(['Physics']);
  });

  it('keeps genuinely different subjects and their order', () => {
    expect(normalizeSubjects(['chem', 'bio', 'phy'])).toEqual(['Chemistry', 'Biology', 'Physics']);
  });

  it('normalises languages the same way', () => {
    expect(normalizeLanguages(['eng', 'English', 'tam'])).toEqual(['English', 'Tamil']);
  });
});
