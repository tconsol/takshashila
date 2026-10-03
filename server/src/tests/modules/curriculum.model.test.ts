import { CurriculumModel } from '../../modules/curricula/curriculum.model';

describe('Curriculum model', () => {
  it('validates a curriculum with ordered chapters', () => {
    const doc = new CurriculumModel({
      publicId: 'curriculum-1',
      country: 'US',
      stateCode: 'NC',
      level: 'GRADE',
      grade: 'Grade 8',
      subject: 'Mathematics',
      title: 'Algebra I',
      createdByAdminPublicId: 'admin-1',
      isPublished: false,
      chapters: [
        { publicId: 'ch-1', title: 'Linear Equations', order: 0, topics: [] },
        { publicId: 'ch-2', title: 'Quadratic Equations', order: 1, topics: [] },
      ],
      isDeleted: false,
    });

    expect(doc.validateSync()).toBeUndefined();
    expect(doc.topics).toHaveLength(2);
    expect(doc.topics[0].title).toBe('Linear Equations');
  });

  it('requires a stateCode, level, grade, subject and title', () => {
    const doc = new CurriculumModel({ publicId: 'curriculum-2', createdByAdminPublicId: 'admin-1', topics: [] });
    const err = doc.validateSync();
    expect(err).toBeDefined();
    expect(Object.keys(err!.errors)).toEqual(
      expect.arrayContaining(['stateCode', 'level', 'grade', 'subject', 'title']),
    );
  });
});
