import { mergeChapters } from '../modules/curricula/curriculum.service';

describe('mergeChapters', () => {
  const existing = [
    { publicId: 'a', title: 'Fractions', order: 0, topics: [{ publicId: 'a1', title: 'Halves', order: 0 }, { publicId: 'a2', title: 'Quarters', order: 1 }] },
    { publicId: 'b', title: 'Decimals', order: 1, topics: [] },
  ];

  it('keeps existing chapter and topic ids when the client omits them', () => {
    const out = mergeChapters(existing, [
      { title: 'Fractions', topics: [{ title: 'Halves' }, { title: 'Quarters' }] },
      { title: 'Decimals', topics: [] },
    ]);
    expect(out.map((c) => c.publicId)).toEqual(['a', 'b']);
    expect(out[0].topics.map((t) => t.publicId)).toEqual(['a1', 'a2']);
  });

  it('matches by title when order changes and renumbers order', () => {
    const out = mergeChapters(existing, [{ title: 'Decimals', topics: [] }, { title: 'Fractions', topics: [] }]);
    expect(out.map((c) => c.publicId)).toEqual(['b', 'a']);
    expect(out.map((c) => c.order)).toEqual([0, 1]);
  });

  it('gives new chapters and topics a fresh id and drops removed ones', () => {
    const out = mergeChapters(existing, [
      { publicId: 'a', title: 'Fractions', topics: [{ publicId: 'a1', title: 'Halves' }, { title: 'Eighths' }] },
      { title: 'Ratios', topics: [] },
    ]);
    expect(out[0].publicId).toBe('a');
    expect(out[0].topics[0].publicId).toBe('a1');
    expect(out[0].topics[1].publicId).not.toBe('a2');
    expect(out[1].publicId).not.toBe('b');
    expect(out).toHaveLength(2);
  });

  it('renaming a chapter by id keeps its id', () => {
    const out = mergeChapters(existing, [{ publicId: 'a', title: 'Fractions & Parts', topics: [] }]);
    expect(out[0]).toMatchObject({ publicId: 'a', title: 'Fractions & Parts' });
  });
});
