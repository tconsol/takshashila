import { courseService } from '../../modules/courses/course.service';
import { CourseModel } from '../../modules/courses/course.model';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });
const leanChain = (v: unknown) => ({
  sort: () => ({ skip: () => ({ limit: () => lean(v) }) }),
});

describe('CourseService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('create() persists a course with the given admin as author', async () => {
    const created = { toObject: () => ({ publicId: 'course-1', title: 'Algebra I' }) };
    const createSpy = jest.spyOn(CourseModel, 'create').mockResolvedValue(created as never);

    const result = await courseService.create('admin-user-1', {
      county: 'Wake County',
      grade: 'Grade 8',
      subject: 'Mathematics',
      title: 'Algebra I',
      topics: [],
    } as never);

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ createdByAdminPublicId: 'admin-user-1', isPublished: false, county: 'Wake County' }),
    );
    expect(result.title).toBe('Algebra I');
  });

  it('listCatalog() only returns published courses matching county+grade', async () => {
    const findSpy = jest.spyOn(CourseModel, 'find').mockReturnValue(leanChain([]) as never);
    jest.spyOn(CourseModel, 'countDocuments').mockResolvedValue(0 as never);

    await courseService.listCatalog({ county: 'Wake County', grade: 'Grade 8' });

    expect(findSpy).toHaveBeenCalledWith(
      expect.objectContaining({ county: 'Wake County', grade: 'Grade 8', isPublished: true, isDeleted: false }),
    );
  });
});
