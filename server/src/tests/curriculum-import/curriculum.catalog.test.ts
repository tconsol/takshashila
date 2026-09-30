import { curriculumService, gradeRank } from '../../modules/curricula/curriculum.service';
import { GRADE_LIST } from '../../modules/students/student.validators';
import { CurriculumModel } from '../../modules/curricula/curriculum.model';
import { settingsService } from '../../modules/settings/settings.service';
import { PLATFORM_SETTINGS_DEFAULTS } from '../../modules/settings/settings.model';
import { curriculumStateCatalogQuerySchema } from '../../modules/curricula/curriculum.validators';

const chain = (rows: unknown[]) => {
  const c: any = { sort: () => c, limit: () => c, lean: () => Promise.resolve(rows) };
  return c;
};

describe('curriculumService.listByState', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(settingsService, 'get').mockResolvedValue({ enabledSubjects: ['Mathematics', 'Science'] } as never);
  });

  it('defaults enable the five core subjects', () => {
    expect(PLATFORM_SETTINGS_DEFAULTS.enabledSubjects).toEqual([
      'English Language Arts', 'Mathematics', 'Science', 'Social Studies', 'Computer Science',
    ]);
  });

  it('filters by state, published and enabled subjects; sorts Kindergarten before Grade 1', async () => {
    const find = jest.spyOn(CurriculumModel, 'find').mockReturnValue(chain([
      { grade: 'Grade 1', subject: 'Science', title: 'B' },
      { grade: 'Kindergarten', subject: 'Mathematics', title: 'A' },
    ]) as never);
    const res = await curriculumService.listByState({ stateCode: 'CO' });
    expect(res.curricula.map((c) => c.grade)).toEqual(['Kindergarten', 'Grade 1']);
    expect(res.stateLoaded).toBe(true);
    const filter = (find.mock.calls as any[][])[0][0];
    expect(filter).toMatchObject({ stateCode: 'CO', isPublished: true, isDeleted: false });
    expect(filter.subject).toEqual({ $in: ['Mathematics', 'Science'] });
    expect((find.mock.calls as any[][])[0][1]).toEqual({ sourceKind: 0, createdByAdminPublicId: 0 });
  });

  it('a disabled subject requested explicitly yields nothing', async () => {
    jest.spyOn(CurriculumModel, 'find').mockReturnValue(chain([]) as never);
    jest.spyOn(CurriculumModel, 'exists').mockResolvedValue({ _id: 'x' } as never);
    const res = await curriculumService.listByState({ stateCode: 'CO', subject: 'Music' });
    expect(res.curricula).toEqual([]);
    expect(res.stateLoaded).toBe(true);
  });

  it('stateLoaded is false when nothing is published for the state', async () => {
    jest.spyOn(CurriculumModel, 'find').mockReturnValue(chain([]) as never);
    jest.spyOn(CurriculumModel, 'exists').mockResolvedValue(null as never);
    const res = await curriculumService.listByState({ stateCode: 'WY' });
    expect(res).toEqual({ curricula: [], stateLoaded: false });
  });

  it('a Grade 9-12 student gets the High School curricula (grade filter becomes High School)', async () => {
    for (const grade of ['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12']) {
      const find = jest.spyOn(CurriculumModel, 'find').mockReturnValue(chain([
        { grade: 'High School', subject: 'Mathematics', title: 'Mathematics - Algebra I - High School' },
      ]) as never);
      const res = await curriculumService.listByState({ stateCode: 'CO', grade });
      expect((find.mock.calls as any[][])[0][0].grade).toBe('High School');
      expect(res.curricula.map((c) => c.title)).toEqual(['Mathematics - Algebra I - High School']);
      find.mockRestore();
    }
  });

  it('K-8 grade filters are unchanged', async () => {
    const find = jest.spyOn(CurriculumModel, 'find').mockReturnValue(chain([{ grade: 'Grade 8', subject: 'Science', title: 'S' }]) as never);
    await curriculumService.listByState({ stateCode: 'CO', grade: 'Grade 8' });
    await curriculumService.listByState({ stateCode: 'CO', grade: 'Kindergarten' });
    expect((find.mock.calls as any[][]).map((c) => c[0].grade)).toEqual(['Grade 8', 'Kindergarten']);
  });

  it('All grades returns everything with High School sorted last', async () => {
    const find = jest.spyOn(CurriculumModel, 'find').mockReturnValue(chain([
      { grade: 'High School', subject: 'Science', title: 'A' },
      { grade: 'Grade 8', subject: 'Science', title: 'Z' },
      { grade: 'Kindergarten', subject: 'Mathematics', title: 'M' },
      { grade: 'Grade 12', subject: 'Mathematics', title: 'Legacy' },
    ]) as never);
    const res = await curriculumService.listByState({ stateCode: 'CO' });
    expect((find.mock.calls as any[][])[0][0]).not.toHaveProperty('grade');
    expect(res.curricula.map((c) => c.grade)).toEqual(['Kindergarten', 'Grade 8', 'Grade 12', 'High School']);
  });

  it('gradeRank puts High School after Grade 8 and every other grade, before unknown strings', () => {
    expect(gradeRank('High School')).toBeGreaterThan(gradeRank('Grade 8'));
    expect(gradeRank('High School')).toBeGreaterThan(gradeRank('Grade 12'));
    expect(gradeRank('Something')).toBeGreaterThan(gradeRank('High School'));
  });

  it('student profile grades do not include High School', () => {
    expect((GRADE_LIST as readonly string[]).includes('High School')).toBe(false);
    expect(curriculumStateCatalogQuerySchema.safeParse({ stateCode: 'CO', grade: 'High School' }).success).toBe(false);
  });

  it('zod rejects unknown state codes', () => {
    expect(curriculumStateCatalogQuerySchema.safeParse({ stateCode: 'ZZ' }).success).toBe(false);
    expect(curriculumStateCatalogQuerySchema.safeParse({ stateCode: 'CO', grade: 'Grade 3' }).success).toBe(true);
  });
});
