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
});
