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
    jest.spyOn(CurriculumModel, 'findOne').mockReturnValue(lean({ publicId: 'curriculum-1' }) as never);
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

  it('update() rejects district/topics changes on imported state curricula, allows other fields', async () => {
    jest.spyOn(CurriculumModel, 'findOne').mockReturnValue(lean({ stateCode: 'CO', chapters: [] }) as never);
    const upd = jest.spyOn(CurriculumModel, 'findOneAndUpdate').mockReturnValue(lean({ publicId: 'c' }) as never);
    await expect(curriculumService.update('c', { districtId: '5101260' } as never)).rejects.toMatchObject({ statusCode: 400 });
    await expect(curriculumService.update('c', { topics: [] } as never)).rejects.toMatchObject({ statusCode: 400 });
    expect(upd).not.toHaveBeenCalled();
    await curriculumService.update('c', { title: 'New' } as never);
    expect(upd).toHaveBeenCalled();
  });

  it('update() rejects topics change when chapters are non-empty', async () => {
    jest.spyOn(CurriculumModel, 'findOne').mockReturnValue(lean({ chapters: [{ publicId: 'x' }] }) as never);
    await expect(curriculumService.update('c', { topics: [] } as never)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('listForAdmin() state filter matches legacy state and imported stateCode', async () => {
    const findSpy = jest.spyOn(CurriculumModel, 'find').mockReturnValue({ sort: () => ({ skip: () => ({ limit: () => lean([]) }) }) } as never);
    jest.spyOn(CurriculumModel, 'countDocuments').mockResolvedValue(0 as never);
    await curriculumService.listForAdmin({ state: 'CO' } as never);
    expect((findSpy.mock.calls as any[][])[0][0]).toMatchObject({ $or: [{ state: 'CO' }, { stateCode: 'CO' }] });
  });

  it('getByPublicId() with forStudent projects out import metadata', async () => {
    const fo = jest.spyOn(CurriculumModel, 'findOne').mockReturnValue(lean({ publicId: 'c' }) as never);
    await curriculumService.getByPublicId('c', { forStudent: true });
    expect((fo.mock.calls as any[][])[0][1]).toEqual({ sourceKind: 0, createdByAdminPublicId: 0 });
  });
});
