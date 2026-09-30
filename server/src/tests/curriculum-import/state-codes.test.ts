import { stateCodeFromName } from '../../modules/geo/state-codes';
import { GRADE_LIST } from '../../modules/students/student.validators';

describe('stateCodeFromName', () => {
  it('maps full names to USPS codes, ignoring case and spaces', () => {
    expect(stateCodeFromName('Colorado')).toBe('CO');
    expect(stateCodeFromName('  hawaii ')).toBe('HI');
    expect(stateCodeFromName('District of Columbia')).toBe('DC');
  });
  it('returns null for unknown names', () => {
    expect(stateCodeFromName('Atlantis')).toBeNull();
  });
});

describe('GRADE_LIST', () => {
  it('has Kindergarten first, then Grade 1 to 12', () => {
    expect(GRADE_LIST[0]).toBe('Kindergarten');
    expect(GRADE_LIST[1]).toBe('Grade 1');
    expect(GRADE_LIST[GRADE_LIST.length - 1]).toBe('Grade 12');
    expect(GRADE_LIST).toHaveLength(13);
  });
});
