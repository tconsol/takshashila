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
      country: 'US',
      state: 'NC',
      countyFips: '37183',
      grade: 'Grade 8',
      subject: 'Mathematics',
      title: 'Algebra I',
      topics: [],
    } as never);

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        createdByAdminPublicId: 'admin-user-1',
        isPublished: false,
        country: 'US',
        state: 'NC',
        countyFips: '37183',
        county: 'Wake County', // derived from the FIPS code, not sent by the client
      }),
    );
    expect(result.title).toBe('Algebra I');
  });

  it('update() re-derives the county name when the location changes', async () => {
    const updateSpy = jest.spyOn(CourseModel, 'findOneAndUpdate').mockReturnValue(lean({ publicId: 'course-1' }) as never);

    await courseService.update('course-1', { state: 'VA', countyFips: '51059' } as never);

    expect(updateSpy).toHaveBeenCalledWith(
      expect.anything(),
      { $set: expect.objectContaining({ state: 'VA', countyFips: '51059', county: 'Fairfax County' }) },
      expect.anything(),
    );
  });

  it('listCatalog() only returns published courses matching countyFips+grade', async () => {
    const findSpy = jest.spyOn(CourseModel, 'find').mockReturnValue(leanChain([]) as never);
    jest.spyOn(CourseModel, 'countDocuments').mockResolvedValue(0 as never);

    await courseService.listCatalog({ countyFips: '37183', grade: 'Grade 8' });

    expect(findSpy).toHaveBeenCalledWith(
      expect.objectContaining({ countyFips: '37183', grade: 'Grade 8', isPublished: true, isDeleted: false }),
    );
  });
});
