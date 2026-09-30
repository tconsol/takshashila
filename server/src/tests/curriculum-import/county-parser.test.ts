import { parseCountyAdditions } from '../../modules/curricula/import/county-parser';
import { CountyAdditionModel } from '../../modules/curricula/county-addition.model';

const h = (n: number, text: string) => ({ style: `Heading${n}`, text });
const li = (text: string) => ({ style: 'ListBullet', text });
const p = (text: string) => ({ style: '', text });

describe('parseCountyAdditions', () => {
  it('reads county, grade band and category lines', () => {
    const out = parseCountyAdditions([h(1, 'County Additions'), h(2, 'Adams County'), h(3, 'Grades 3-5'), li('Local history: Study of the Front Range'), li('Field trip: Farm visit'), h(3, 'Kindergarten'), li('Community: Helpers')]);
    expect(out).toEqual([
      { county: 'Adams County', district: '', gradeFrom: 3, gradeTo: 5, category: 'Local history', description: 'Study of the Front Range' },
      { county: 'Adams County', district: '', gradeFrom: 3, gradeTo: 5, category: 'Field trip', description: 'Farm visit' },
      { county: 'Adams County', district: '', gradeFrom: 0, gradeTo: 0, category: 'Community', description: 'Helpers' },
    ]);
  });
  it('treats a District heading as district', () => {
    const out = parseCountyAdditions([h(2, 'Denver Public School District'), h(3, 'Grade 1'), li('Art: Murals')]);
    expect(out[0]).toMatchObject({ district: 'Denver Public School District', gradeFrom: 1, gradeTo: 1 });
  });
  it('reads the real Georgia layout: en-dash bands with a suffix, unstyled paragraphs, colons and parentheses in descriptions', () => {
    const out = parseCountyAdditions([
      h(2, 'Fulton County Schools'), h(3, 'Grades 6–8 (Middle School)'),
      p('Computer Science: Foundations of Interactive Design / Interactive Game Design (exploratory)'),
      h(3, 'Grade 10'), p('Computer Science: AP Computer Science Principles (11.01900), Grades 10–11'),
      h(2, 'Cobb County Schools'), h(3, 'Grade 11'), p('Mathematics: Multivariable Calculus (Magnet/Dual Enrollment)'),
    ]);
    expect(out).toEqual([
      { county: 'Fulton County Schools', district: '', gradeFrom: 6, gradeTo: 8, category: 'Computer Science', description: 'Foundations of Interactive Design / Interactive Game Design (exploratory)' },
      { county: 'Fulton County Schools', district: '', gradeFrom: 10, gradeTo: 10, category: 'Computer Science', description: 'AP Computer Science Principles (11.01900), Grades 10–11' },
      { county: 'Cobb County Schools', district: '', gradeFrom: 11, gradeTo: 11, category: 'Mathematics', description: 'Multivariable Calculus (Magnet/Dual Enrollment)' },
    ]);
  });
  it('defaults a band with no numbers to K-12, appends continuation lines, and ignores lines before any heading', () => {
    const out = parseCountyAdditions([p('orphan: ignored'), h(2, 'Lee County'), li('Art: Murals'), p('painted by students'), h(3, 'All grades'), li('Music: Choir')]);
    expect(out).toEqual([
      { county: 'Lee County', district: '', gradeFrom: 0, gradeTo: 12, category: 'Art', description: 'Murals painted by students' },
      { county: 'Lee County', district: '', gradeFrom: 0, gradeTo: 12, category: 'Music', description: 'Choir' },
    ]);
  });
  it('ignores numbers inside parentheses in a grade heading and reads long category names', () => {
    const out = parseCountyAdditions([h(2, 'Pima County'), h(3, 'Grades 10–12 (central campuses and 36 satellite programs)'), li('Science, Technology, Engineering, and Mathematics: Magnet school')]);
    expect(out).toEqual([{ county: 'Pima County', district: '', gradeFrom: 10, gradeTo: 12, category: 'Science, Technology, Engineering, and Mathematics', description: 'Magnet school' }]);
  });
  it('returns nothing for an empty section', () => {
    expect(parseCountyAdditions([])).toEqual([]);
  });
});

describe('parseCountyAdditions duplicates and continuations', () => {
  it('merges the same category in one band into one entry', () => {
    const out = parseCountyAdditions([h(2, 'Lee County'), h(3, 'Grade 3'), li('Field trip: Farm visit'), li('Field trip: Museum'), li('Art: Murals')]);
    expect(out).toEqual([
      { county: 'Lee County', district: '', gradeFrom: 3, gradeTo: 3, category: 'Field trip', description: 'Farm visit\nMuseum' },
      { county: 'Lee County', district: '', gradeFrom: 3, gradeTo: 3, category: 'Art', description: 'Murals' },
    ]);
  });
  it('merges when a band heading repeats under a county, but not across counties or bands', () => {
    const out = parseCountyAdditions([h(2, 'Lee County'), h(3, 'Grade 3'), li('Art: A'), h(3, 'Grade 4'), li('Art: B'), h(3, 'Grade 3'), li('Art: C'), h(2, 'Polk County'), h(3, 'Grade 3'), li('Art: D')]);
    expect(out.map((o) => [o.county, o.gradeFrom, o.description])).toEqual([['Lee County', 3, 'A\nC'], ['Lee County', 4, 'B'], ['Polk County', 3, 'D']]);
  });
  it('treats a time in a continuation line as a continuation', () => {
    const out = parseCountyAdditions([h(2, 'Lee County'), li('Club: Robotics'), li('Meets at 3:30 pm')]);
    expect(out).toEqual([{ county: 'Lee County', district: '', gradeFrom: 0, gradeTo: 12, category: 'Club', description: 'Robotics Meets at 3:30 pm' }]);
  });
  it('treats a URL line as a continuation', () => {
    const out = parseCountyAdditions([h(2, 'Lee County'), li('Club: Robotics'), li('https://example.org/club')]);
    expect(out).toHaveLength(1);
    expect(out[0].description).toBe('Robotics https://example.org/club');
  });
  it('does not start a category with a digit', () => {
    expect(parseCountyAdditions([h(2, 'Lee County'), li('3D: printing')])).toEqual([]);
  });
  it('still parses long category names', () => {
    const out = parseCountyAdditions([h(2, 'Lee County'), li('Science, Technology, Engineering, and Mathematics: Magnet')]);
    expect(out[0].category).toBe('Science, Technology, Engineering, and Mathematics');
  });
});

describe('CountyAddition model', () => {
  const base = { stateCode: 'ga', county: 'Fulton County Schools', district: '', gradeFrom: 6, gradeTo: 8, category: 'Computer Science', description: 'Foundations' };
  it('accepts a valid entry with draft defaults', () => {
    const d = new CountyAdditionModel(base);
    expect(d.validateSync()).toBeUndefined();
    expect(d.isPublished).toBe(false);
    expect(d.isDeleted).toBe(false);
    expect(d.stateCode).toBe('GA');
    expect(d.publicId).toBeTruthy();
    expect(d.topics).toHaveLength(0);
  });
  it('requires stateCode, county and category', () => {
    const { stateCode, county, category, ...rest } = base;
    void stateCode; void county; void category;
    const err = new CountyAdditionModel(rest).validateSync();
    expect(Object.keys(err!.errors).sort()).toEqual(['category', 'county', 'stateCode']);
  });
  it('rejects gradeFrom greater than gradeTo', () => {
    const err = new CountyAdditionModel({ ...base, gradeFrom: 9, gradeTo: 3 }).validateSync();
    expect(err!.errors.gradeTo).toBeDefined();
  });
});
