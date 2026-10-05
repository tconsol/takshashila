import { normalizeFrontendUrl } from '../../config/env';

describe('normalizeFrontendUrl', () => {
  it.each([
    ['https://brainbaseedu.com/', 'https://brainbaseedu.com'],
    ['https://brainbaseedu.com///', 'https://brainbaseedu.com'],
    // The live server had a list here, which produced
    // https://brainbaseedu.com/,https://www.brainbaseedu.com/verify-email?token=...
    ['https://brainbaseedu.com/,https://www.brainbaseedu.com/', 'https://brainbaseedu.com'],
    [' https://brainbaseedu.com , https://www.brainbaseedu.com ', 'https://brainbaseedu.com'],
    ['http://localhost:5173', 'http://localhost:5173'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeFrontendUrl(input)).toBe(expected);
  });

  it('builds a clean verify link from a list value', () => {
    const base = normalizeFrontendUrl('https://brainbaseedu.com/,https://www.brainbaseedu.com/');
    expect(`${base}/verify-email?token=abc`).toBe('https://brainbaseedu.com/verify-email?token=abc');
  });
});
