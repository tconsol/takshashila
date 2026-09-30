import { readDocxParagraphs } from '../../modules/curricula/import/docx-reader';
import { buildDocx } from './docx-fixture';

describe('readDocxParagraphs', () => {
  it('returns style and text per paragraph', () => {
    const buf = buildDocx([{ style: 'Heading1', text: 'Grade 3' }, { text: 'Plain line' }, { style: 'ListBullet', text: 'Fractions & decimals <5' }]);
    expect(readDocxParagraphs(buf)).toEqual([
      { style: 'Heading1', text: 'Grade 3' },
      { style: '', text: 'Plain line' },
      { style: 'ListBullet', text: 'Fractions & decimals <5' },
    ]);
  });
  it('skips paragraphs with no text', () => {
    expect(readDocxParagraphs(buildDocx([{ text: '   ' }, { text: 'x' }]))).toEqual([{ style: '', text: 'x' }]);
  });
  it('throws a clear error for a file that is not a docx', () => {
    expect(() => readDocxParagraphs(Buffer.from('not a zip'))).toThrow(/not a valid \.docx/i);
  });
  it('treats soft line breaks as spaces', () => {
    expect(readDocxParagraphs(buildDocx([{ text: 'Line1\nLine2' }]))).toEqual([{ style: '', text: 'Line1 Line2' }]);
  });
  it('leaves out-of-range numeric entities as-is', () => {
    expect(readDocxParagraphs(buildDocx([{ text: 'a &#99999999; b', raw: true }]))[0].text).toBe('a &#99999999; b');
  });
});
