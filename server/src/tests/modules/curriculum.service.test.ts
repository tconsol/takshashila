import { curriculumService } from '../../modules/curricula/curriculum.service';
import { CurriculumModel } from '../../modules/curricula/curriculum.model';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });
const catalogChain = (v: unknown) => ({ sort: () => ({ limit: () => lean(v) }) });

describe('CurriculumService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('create() derives every location field from the district', async () => {
    const created = { toObject: () => ({ publicId: 'curriculum-1', title: 'Algebra I' }) };
    const createSpy = jest.spyOn(CurriculumModel, 'create').mockResolvedValue(created as never);

    const result = await curriculumService.create('admin-user-1', {
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
      curriculumService.create('admin-user-1', { districtId: '9999999', grade: 'Grade 8', subject: 'M', title: 'T', topics: [] } as never),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('update() re-derives location when the district changes', async () => {
    const updateSpy = jest.spyOn(CurriculumModel, 'findOneAndUpdate').mockReturnValue(lean({ publicId: 'curriculum-1' }) as never);

    await curriculumService.update('curriculum-1', { districtId: '5101260' } as never);

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
    const findSpy = jest.spyOn(CurriculumModel, 'find').mockReturnValue(catalogChain([]) as never);

    await curriculumService.listCatalog({ districtId: '3704720', grade: 'Grade 8' });

    expect(findSpy).toHaveBeenCalledWith({ districtId: '3704720', grade: 'Grade 8', isPublished: true, isDeleted: false });
  });

  it('listCatalog() without grade returns all grades, ordered Grade 9 before Grade 10, then by title', async () => {
    const findSpy = jest.spyOn(CurriculumModel, 'find').mockReturnValue(
      catalogChain([
        { title: 'A', grade: 'Grade 10' },
        { title: 'B', grade: 'Grade 9' },
        { title: 'A', grade: 'Grade 9' },
        { title: 'Z', grade: 'Grade 1' },
      ]) as never,
    );

    const result = await curriculumService.listCatalog({ districtId: '3704720' });

    expect(findSpy).toHaveBeenCalledWith({ districtId: '3704720', isPublished: true, isDeleted: false });
    expect(result.map((c) => `${c.grade}/${c.title}`)).toEqual(['Grade 1/Z', 'Grade 9/A', 'Grade 9/B', 'Grade 10/A']);
  });
});
