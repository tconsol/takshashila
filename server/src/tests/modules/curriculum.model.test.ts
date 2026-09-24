import { CurriculumModel } from '../../modules/curricula/curriculum.model';

describe('Curriculum model', () => {
  it('validates a curriculum with ordered topics and attached content ids', () => {
    const doc = new CurriculumModel({
      publicId: 'curriculum-1',
      country: 'US',
      state: 'NC',
      countyFips: '37183',
      county: 'Wake County',
      districtId: '3704720',
      district: 'Wake County Schools',
      grade: 'Grade 8',
      subject: 'Mathematics',
      title: 'Algebra I',
      createdByAdminPublicId: 'admin-1',
      isPublished: false,
      topics: [
        { publicId: 'topic-1', title: 'Linear Equations', order: 0, resourceIds: ['res-1'], assignmentIds: [], worksheetIds: ['ws-1'] },
        { publicId: 'topic-2', title: 'Quadratic Equations', order: 1, resourceIds: [], assignmentIds: ['a-1'], worksheetIds: [] },
      ],
      isDeleted: false,
    });

    expect(doc.validateSync()).toBeUndefined();
    expect(doc.topics).toHaveLength(2);
    expect(doc.topics[0].title).toBe('Linear Equations');
  });

  it('requires districtId, district, state, countyFips, county, grade, subject and title', () => {
    const doc = new CurriculumModel({ publicId: 'curriculum-2', createdByAdminPublicId: 'admin-1', topics: [] });
    const err = doc.validateSync();
    expect(err).toBeDefined();
    expect(Object.keys(err!.errors)).toEqual(
      expect.arrayContaining(['districtId', 'district', 'state', 'countyFips', 'county', 'grade', 'subject', 'title']),
    );
  });
});
