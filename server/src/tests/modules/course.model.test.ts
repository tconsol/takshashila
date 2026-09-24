import { CourseModel } from '../../modules/courses/course.model';

describe('Course model', () => {
  it('validates a course with ordered topics and attached content ids', () => {
    const doc = new CourseModel({
      publicId: 'course-1',
      country: 'US',
      state: 'NC',
      countyFips: '37183',
      county: 'Wake County',
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

  it('requires state, countyFips, county, grade, subject and title', () => {
    const doc = new CourseModel({ publicId: 'course-2', createdByAdminPublicId: 'admin-1', topics: [] });
    const err = doc.validateSync();
    expect(err).toBeDefined();
    expect(Object.keys(err!.errors)).toEqual(
      expect.arrayContaining(['state', 'countyFips', 'county', 'grade', 'subject', 'title']),
    );
  });
});
