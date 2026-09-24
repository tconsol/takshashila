import { courseService } from '../../modules/courses/course.service';
import { CourseModel } from '../../modules/courses/course.model';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });
const catalogChain = (v: unknown) => ({ sort: () => ({ limit: () => lean(v) }) });

describe('CourseService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('create() derives every location field from the district', async () => {
    const created = { toObject: () => ({ publicId: 'course-1', title: 'Algebra I' }) };
    const createSpy = jest.spyOn(CourseModel, 'create').mockResolvedValue(created as never);

    const result = await courseService.create('admin-user-1', {
      districtId: '3704720',
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
        county: 'Wake County',
        districtId: '3704720',
        district: 'Wake County Schools',
      }),
    );
    expect(result.title).toBe('Algebra I');
  });

  it('create() rejects an unknown district', async () => {
    await expect(
      courseService.create('admin-user-1', { districtId: '9999999', grade: 'Grade 8', subject: 'M', title: 'T', topics: [] } as never),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('update() re-derives location when the district changes', async () => {
    const updateSpy = jest.spyOn(CourseModel, 'findOneAndUpdate').mockReturnValue(lean({ publicId: 'course-1' }) as never);

    await courseService.update('course-1', { districtId: '5101260' } as never);

    expect(updateSpy).toHaveBeenCalledWith(
      expect.anything(),
      {
        $set: expect.objectContaining({
          state: 'VA', countyFips: '51059', county: 'Fairfax County',
          districtId: '5101260', district: 'Fairfax County Public Schools',
        }),
      },
      expect.anything(),
    );
  });

  it('listCatalog() filters by district and grade when grade is given', async () => {
    const findSpy = jest.spyOn(CourseModel, 'find').mockReturnValue(catalogChain([]) as never);

    await courseService.listCatalog({ districtId: '3704720', grade: 'Grade 8' });

    expect(findSpy).toHaveBeenCalledWith({ districtId: '3704720', grade: 'Grade 8', isPublished: true, isDeleted: false });
  });

  it('listCatalog() without grade returns all grades, ordered Grade 9 before Grade 10, then by title', async () => {
    const findSpy = jest.spyOn(CourseModel, 'find').mockReturnValue(
      catalogChain([
        { title: 'A', grade: 'Grade 10' },
        { title: 'B', grade: 'Grade 9' },
        { title: 'A', grade: 'Grade 9' },
        { title: 'Z', grade: 'Grade 1' },
      ]) as never,
    );

    const result = await courseService.listCatalog({ districtId: '3704720' });

    expect(findSpy).toHaveBeenCalledWith({ districtId: '3704720', isPublished: true, isDeleted: false });
    expect(result.map((c) => `${c.grade}/${c.title}`)).toEqual(['Grade 1/Z', 'Grade 9/A', 'Grade 9/B', 'Grade 10/A']);
  });
});
