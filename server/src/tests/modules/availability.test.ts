// server/src/tests/modules/availability.test.ts
import { isWithinAvailability } from '../../shared/availability';

const window = { daysOfWeek: [1, 2, 3], startLocalTime: '16:00', endLocalTime: '19:00', ianaTimezone: 'UTC' };

describe('isWithinAvailability', () => {
  it('accepts a slot inside the window on an allowed day', () => {
    // 2026-09-28 is a Monday
    expect(isWithinAvailability(window, new Date('2026-09-28T16:30:00Z'), new Date('2026-09-28T17:30:00Z'))).toBe(true);
  });

  it('rejects a disallowed day, an early start, and an end past the window', () => {
    expect(isWithinAvailability(window, new Date('2026-09-27T16:30:00Z'), new Date('2026-09-27T17:00:00Z'))).toBe(false); // Sunday
    expect(isWithinAvailability(window, new Date('2026-09-28T15:30:00Z'), new Date('2026-09-28T16:30:00Z'))).toBe(false);
    expect(isWithinAvailability(window, new Date('2026-09-28T18:30:00Z'), new Date('2026-09-28T19:30:00Z'))).toBe(false);
  });

  it('evaluates in the window\'s timezone', () => {
    const ny = { ...window, ianaTimezone: 'America/New_York' };
    // 20:30Z = 16:30 in New York (EDT)
    expect(isWithinAvailability(ny, new Date('2026-09-28T20:30:00Z'), new Date('2026-09-28T21:30:00Z'))).toBe(true);
  });
});
