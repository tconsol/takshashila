import { curriculumService } from '../../modules/curricula/curriculum.service';
import { CurriculumModel } from '../../modules/curricula/curriculum.model';
import { publishStateSchema } from '../../modules/curricula/curriculum.validators';

describe('curriculumService.publishAllForState', () => {
  afterEach(() => jest.restoreAllMocks());

  it('publishes only the drafts of that state and reports how many changed', async () => {
    const update = jest.spyOn(CurriculumModel, 'updateMany').mockResolvedValue({ modifiedCount: 125 } as never);
    const res = await curriculumService.publishAllForState('CO');
    expect(res).toEqual({ published: 125 });
    expect(update).toHaveBeenCalledWith(
      { stateCode: 'CO', isDeleted: false, isPublished: false },
      { $set: { isPublished: true } },
    );
  });

  it('rejects an unknown state code', () => {
    expect(publishStateSchema.safeParse({ stateCode: 'ZZ' }).success).toBe(false);
    expect(publishStateSchema.safeParse({ stateCode: 'CO' }).success).toBe(true);
  });
});
