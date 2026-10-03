import { CurriculumModel } from '../../modules/curricula/curriculum.model';

const base = { subject: 'Mathematics', grade: 'Grade 3', title: 'Mathematics Grade 3', createdByAdminPublicId: 'sys' };

describe('Curriculum model', () => {
  it('accepts a state curriculum with chapters and mirrors them into topics', () => {
    const doc = new CurriculumModel({
      ...base, stateCode: 'CO', level: 'GRADE', sourceKind: 'revised',
      source: { name: 'Colorado Academic Standards', year: 2020, url: 'https://cde.state.co.us' },
      chapters: [{ title: 'Fractions', order: 1, topics: [{ title: 'Halves', order: 1 }, { title: 'Quarters', order: 2 }] }],
    });
    expect(doc.validateSync()).toBeUndefined();
    expect(doc.topics).toHaveLength(1);
    expect(doc.topics[0].publicId).toBe(doc.chapters[0].publicId);
    expect(doc.topics[0].title).toBe('Fractions');
    expect(doc.chapters[0].topics[0].publicId).toBeTruthy();
  });
  it('accepts a High School course curriculum and rejects unknown levels', () => {
    const hs = new CurriculumModel({
      ...base, grade: 'High School', title: 'Mathematics - Algebra I - High School', stateCode: 'CO',
      level: 'HIGH_SCHOOL', courseName: 'Algebra I', usualGrade: 'Grade 9',
      chapters: [{ title: 'Linear', order: 0, topics: [{ title: 'Slope', order: 0 }] }],
    });
    expect(hs.validateSync()).toBeUndefined();
    expect(hs.usualGrade).toBe('Grade 9');
    expect(new CurriculumModel({ ...base, stateCode: 'CO', level: 'COLLEGE' }).validateSync()).toBeDefined();
  });
  it('requires a stateCode and a level (there is no district any more)', () => {
    const err = new CurriculumModel({ ...base }).validateSync();
    expect(Object.keys(err!.errors)).toEqual(expect.arrayContaining(['stateCode', 'level']));
  });
  it('has no district or county fields', () => {
    const paths = Object.keys(CurriculumModel.schema.paths);
    for (const gone of ['districtId', 'district', 'countyFips', 'county', 'state']) expect(paths).not.toContain(gone);
  });
});
