import { mergeTopics } from '../modules/curricula/curriculum.service';

describe('mergeTopics', () => {
  const existing = [
    { publicId: 'a', title: 'Fractions', order: 0 },
    { publicId: 'b', title: 'Decimals', order: 1 },
  ];

  it('keeps existing ids when the client omits them', () => {
    const out = mergeTopics(existing, [{ title: 'Fractions' }, { title: 'Decimals' }]);
    expect(out.map((t) => t.publicId)).toEqual(['a', 'b']);
  });

  it('matches by title when order changes', () => {
    const out = mergeTopics(existing, [{ title: 'Decimals' }, { title: 'Fractions' }]);
    expect(out.map((t) => t.publicId)).toEqual(['b', 'a']);
  });

  it('gives new topics a fresh id and drops removed ones', () => {
    const out = mergeTopics(existing, [{ publicId: 'a', title: 'Fractions' }, { title: 'Ratios' }]);
    expect(out[0].publicId).toBe('a');
    expect(out[1].publicId).not.toBe('b');
    expect(out).toHaveLength(2);
  });
});
