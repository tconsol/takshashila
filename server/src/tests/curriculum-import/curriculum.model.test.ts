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
  it('still accepts a legacy district curriculum', () => {
    const doc = new CurriculumModel({
      ...base, state: 'CO', countyFips: '08031', county: 'Denver', districtId: 'd1', district: 'Denver 1',
      topics: [{ title: 'Old topic', order: 1 }],
    });
    expect(doc.validateSync()).toBeUndefined();
    expect(doc.topics).toHaveLength(1);
    expect(doc.chapters).toHaveLength(0);
  });
  it('rejects a document with neither stateCode nor districtId', () => {
    expect(new CurriculumModel({ ...base }).validateSync()).toBeDefined();
  });
});
