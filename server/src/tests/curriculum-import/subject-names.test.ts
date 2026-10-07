import { canonicalSubject } from '../../modules/curricula/import/subject-names';

describe('canonicalSubject', () => {
  it.each([
    ['English Language Arts / Literacy', 'English Language Arts'],
    ['English Language Arts/Literacy', 'English Language Arts'],
    ['Language Arts', 'English Language Arts'],
    ['Math', 'Mathematics'],
    ['Science & Technology/Engineering', 'Science'],
    ['History–Social Science', 'Social Studies'],
    ['Social Sciences', 'Social Studies'],
    ['History, Government, and Social Studies', 'Social Studies'],
    ['Computer Science and Technology', 'Computer Science'],
    ['Digital Literacy & Computer Science', 'Computer Science'],
    ['Health & PE', 'Health and Physical Education'],
    ['Physical Education', 'Physical Education'],
    ['Health', 'Health Education'],
    ['The Arts', 'Fine Arts'],
    ['Visual Art', 'Visual Arts'],
    ['English Language Proficiency / CELP', 'English Language Development'],
    ['Personal Financial Literacy', 'Financial Literacy'],
  ])('%s -> %s', (raw, expected) => {
    expect(canonicalSubject(raw)).toEqual({ name: expected, mapped: true, notSubject: false });
  });

  it('flags blocks that are not subjects', () => {
    expect(canonicalSubject('Grade / Course Emphasis').notSubject).toBe(true);
    expect(canonicalSubject('Additional Local Curriculum').notSubject).toBe(true);
  });

  it('keeps an unknown name as written and marks it unmapped', () => {
    expect(canonicalSubject('Driver Education')).toEqual({ name: 'Driver Education', mapped: false, notSubject: false });
  });
});
