import { resolveCounty } from '../../modules/curricula/county-resolver';
import { countyAdditionService, gradeBand } from '../../modules/curricula/county-addition.service';
import { CountyAdditionModel } from '../../modules/curricula/county-addition.model';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });

describe('resolveCounty', () => {
  it.each([
    ['GA', 'Fulton County Schools', 'Fulton County'],
    ['CO', 'Denver County – Denver Public Schools', 'Denver County'],
    ['CO', 'El Paso County – Colorado Springs School District 11', 'El Paso County'],
    ['AK', 'Municipality of Anchorage – Anchorage School District', 'Anchorage Municipality'],
    ['AK', 'Kenai Peninsula Borough – Kenai Peninsula Borough School District', 'Kenai Peninsula Borough'],
  ])('%s "%s" -> %s', (state, label, expected) => {
    expect(resolveCounty(state, label)?.name).toBe(expected);
  });

  it('returns nothing rather than guessing', () => {
    expect(resolveCounty('GA', 'Nowhere County Schools')).toBeUndefined();
    expect(resolveCounty('ZZ', 'Fulton County Schools')).toBeUndefined();
    expect(resolveCounty('GA', '')).toBeUndefined();
  });
});

describe('gradeBand', () => {
  it('maps grade names to numbers', () => {
    expect(gradeBand('Kindergarten')).toEqual({ from: 0, to: 0 });
    expect(gradeBand('Grade 5')).toEqual({ from: 5, to: 5 });
    expect(gradeBand('High School')).toEqual({ from: 9, to: 12 });
    expect(gradeBand('all')).toBeUndefined();
    expect(gradeBand(undefined)).toBeUndefined();
  });
});

describe('CountyAdditionService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('listForCounty() shows only published, undeleted add-ons of that county whose grades overlap', async () => {
    const find = jest.spyOn(CountyAdditionModel, 'find').mockReturnValue(lean([]) as never);
    await countyAdditionService.listForCounty({ stateCode: 'CO', countyFips: '08031', grade: 'Grade 4' });
    expect((find.mock.calls as unknown as unknown[][])[0][0]).toEqual({
      stateCode: 'CO', countyFips: '08031', isPublished: true, isDeleted: false, gradeFrom: { $lte: 4 }, gradeTo: { $gte: 4 },
    });
  });

  it('listForCounty() without a grade does not filter by grade', async () => {
    const find = jest.spyOn(CountyAdditionModel, 'find').mockReturnValue(lean([]) as never);
    await countyAdditionService.listForCounty({ stateCode: 'CO', countyFips: '08031' });
    expect((find.mock.calls as unknown as unknown[][])[0][0]).not.toHaveProperty('gradeFrom');
  });

  it('create() takes the county name from the county list and starts as a draft', async () => {
    const create = jest.spyOn(CountyAdditionModel, 'create').mockResolvedValue({ toObject: () => ({}) } as never);
    await countyAdditionService.create({ stateCode: 'CO', countyFips: '08031', gradeFrom: 0, gradeTo: 5, category: ' Robotics ', topics: [' Sensors ', ''] });
    expect(create.mock.calls[0][0]).toMatchObject({ stateCode: 'CO', countyFips: '08031', county: 'Denver County', category: 'Robotics', topics: ['Sensors'], isPublished: false });
  });

  it('create() refuses a county from another state', async () => {
    await expect(countyAdditionService.create({ stateCode: 'GA', countyFips: '08031', gradeFrom: 0, gradeTo: 5, category: 'x' })).rejects.toMatchObject({ statusCode: 422 });
  });

  it('create() turns a duplicate into a 409', async () => {
    jest.spyOn(CountyAdditionModel, 'create').mockRejectedValue({ code: 11000 } as never);
    await expect(countyAdditionService.create({ stateCode: 'CO', countyFips: '08031', gradeFrom: 0, gradeTo: 5, category: 'x' })).rejects.toMatchObject({ statusCode: 409 });
  });

  it('setPublished() refuses an add-on that is not linked to a county', async () => {
    jest.spyOn(CountyAdditionModel, 'findOne').mockResolvedValue({ countyFips: undefined, save: jest.fn() } as never);
    await expect(countyAdditionService.setPublished('x', true)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('setPublished() publishes a linked add-on', async () => {
    const doc = { countyFips: '08031', isPublished: false, save: jest.fn(), toObject: () => ({ isPublished: true }) };
    jest.spyOn(CountyAdditionModel, 'findOne').mockResolvedValue(doc as never);
    await countyAdditionService.setPublished('x', true);
    expect(doc.isPublished).toBe(true);
    expect(doc.save).toHaveBeenCalled();
  });

  it('publishAllDrafts() publishes only linked drafts and reports the unlinked ones it skipped', async () => {
    const upd = jest.spyOn(CountyAdditionModel, 'updateMany').mockResolvedValue({ modifiedCount: 7 } as never);
    jest.spyOn(CountyAdditionModel, 'countDocuments').mockResolvedValue(2 as never);
    expect(await countyAdditionService.publishAllDrafts({ stateCode: 'CO' })).toEqual({ published: 7, skippedUnlinked: 2 });
    expect(upd.mock.calls[0][0]).toMatchObject({ stateCode: 'CO', isPublished: false, isDeleted: false, countyFips: { $exists: true } });
    expect(upd.mock.calls[0][1]).toEqual({ $set: { isPublished: true } });
  });

  it('publishAllDrafts() for one county does not touch other counties', async () => {
    const upd = jest.spyOn(CountyAdditionModel, 'updateMany').mockResolvedValue({ modifiedCount: 1 } as never);
    await countyAdditionService.publishAllDrafts({ stateCode: 'CO', countyFips: '08031' });
    expect(upd.mock.calls[0][0]).toMatchObject({ countyFips: '08031' });
  });

  it('remove() 404s for an unknown add-on', async () => {
    jest.spyOn(CountyAdditionModel, 'updateOne').mockResolvedValue({ matchedCount: 0 } as never);
    await expect(countyAdditionService.remove('x')).rejects.toMatchObject({ statusCode: 404 });
  });
});
