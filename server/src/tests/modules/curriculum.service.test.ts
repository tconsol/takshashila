import { curriculumService } from '../../modules/curricula/curriculum.service';
import { CurriculumModel } from '../../modules/curricula/curriculum.model';
import { CourseModel } from '../../modules/courses/course.model';
import { ResourceModel } from '../../modules/resources/resource.model';
import { AssignmentModel } from '../../modules/assignments/assignment.model';
import { WorksheetModel } from '../../modules/worksheets/worksheet.model';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });

describe('CurriculumService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('create() anchors the curriculum on the state and derives the level', async () => {
    const created = { toObject: () => ({ publicId: 'curriculum-1', title: 'Algebra I' }) };
    const createSpy = jest.spyOn(CurriculumModel, 'create').mockResolvedValue(created as never);

    await curriculumService.create('admin-user-1', {
      stateCode: 'CO', grade: 'Kindergarten', subject: 'Mathematics', title: 'Math K',
      chapters: [{ title: 'Counting', topics: [{ title: 'Count to 10' }] }],
    } as never);

    const arg = createSpy.mock.calls[0][0] as unknown as Record<string, any>;
    expect(arg).toMatchObject({ stateCode: 'CO', country: 'US', level: 'KINDERGARTEN', isPublished: false, createdByAdminPublicId: 'admin-user-1' });
    expect(arg).not.toHaveProperty('districtId');
    expect(arg.chapters[0].topics[0].title).toBe('Count to 10');
    expect(arg.topics).toEqual([{ publicId: arg.chapters[0].publicId, title: 'Counting', order: 0 }]);
  });

  it('create() marks High School curricula', async () => {
    const createSpy = jest.spyOn(CurriculumModel, 'create').mockResolvedValue({ toObject: () => ({}) } as never);
    await curriculumService.create('a', { stateCode: 'CO', grade: 'High School', subject: 'Mathematics', title: 'T', chapters: [] } as never);
    expect((createSpy.mock.calls[0][0] as any).level).toBe('HIGH_SCHOOL');
  });

  describe('update() with chapters', () => {
    const existing = {
      publicId: 'c',
      chapters: [
        { publicId: 'ch1', title: 'One', order: 0, topics: [{ publicId: 't1', title: 'A', order: 0 }, { publicId: 't2', title: 'B', order: 1 }] },
        { publicId: 'ch2', title: 'Two', order: 1, topics: [] },
      ],
    };
    const keepCh1 = { publicId: 'ch1', title: 'One', topics: [{ publicId: 't1', title: 'A' }, { publicId: 't2', title: 'B' }] };
    const noMaterials = () => {
      jest.spyOn(ResourceModel, 'countDocuments').mockResolvedValue(0 as never);
      jest.spyOn(AssignmentModel, 'countDocuments').mockResolvedValue(0 as never);
      jest.spyOn(WorksheetModel, 'countDocuments').mockResolvedValue(0 as never);
    };

    it('renames and reorders while keeping ids, and mirrors chapters into topics', async () => {
      jest.spyOn(CurriculumModel, 'findOne').mockReturnValue(lean(existing) as never);
      jest.spyOn(CourseModel, 'find').mockReturnValue(lean([]) as never);
      noMaterials();
      const upd = jest.spyOn(CurriculumModel, 'findOneAndUpdate').mockReturnValue(lean({ publicId: 'c' }) as never);

      await curriculumService.update('c', { chapters: [{ publicId: 'ch2', title: 'Two!', topics: [] }, keepCh1] } as never);

      const set = (upd.mock.calls[0][1] as any).$set;
      expect(set.chapters.map((c: any) => [c.publicId, c.title, c.order])).toEqual([['ch2', 'Two!', 0], ['ch1', 'One', 1]]);
      expect(set.topics.map((t: any) => t.publicId)).toEqual(['ch2', 'ch1']);
    });

    it('refuses to remove a chapter that an active course uses', async () => {
      jest.spyOn(CurriculumModel, 'findOne').mockReturnValue(lean(existing) as never);
      jest.spyOn(CourseModel, 'find').mockReturnValue(lean([{ topicPublicIds: ['ch2'] }]) as never);
      noMaterials();
      const upd = jest.spyOn(CurriculumModel, 'findOneAndUpdate');
      await expect(curriculumService.update('c', { chapters: [keepCh1] } as never)).rejects.toMatchObject({ statusCode: 409 });
      expect(upd).not.toHaveBeenCalled();
    });

    it('refuses to remove a topic that an active course picked', async () => {
      jest.spyOn(CurriculumModel, 'findOne').mockReturnValue(lean(existing) as never);
      jest.spyOn(CourseModel, 'find').mockReturnValue(lean([{ topicPublicIds: ['ch1'], pickedTopicPublicIds: ['t2'] }]) as never);
      noMaterials();
      await expect(curriculumService.update('c', {
        chapters: [{ publicId: 'ch1', title: 'One', topics: [{ publicId: 't1', title: 'A' }] }, { publicId: 'ch2', title: 'Two', topics: [] }],
      } as never)).rejects.toMatchObject({ statusCode: 409 });
    });

    it('refuses to remove a chapter that has materials attached', async () => {
      jest.spyOn(CurriculumModel, 'findOne').mockReturnValue(lean(existing) as never);
      jest.spyOn(CourseModel, 'find').mockReturnValue(lean([]) as never);
      jest.spyOn(ResourceModel, 'countDocuments').mockResolvedValue(1 as never);
      jest.spyOn(AssignmentModel, 'countDocuments').mockResolvedValue(0 as never);
      jest.spyOn(WorksheetModel, 'countDocuments').mockResolvedValue(0 as never);
      await expect(curriculumService.update('c', { chapters: [keepCh1] } as never)).rejects.toMatchObject({ statusCode: 409 });
    });

    it('404s for an unknown curriculum', async () => {
      jest.spyOn(CurriculumModel, 'findOne').mockReturnValue(lean(null) as never);
      await expect(curriculumService.update('x', { chapters: [] } as never)).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  it('update() without chapters leaves chapters and topics alone', async () => {
    const upd = jest.spyOn(CurriculumModel, 'findOneAndUpdate').mockReturnValue(lean({ publicId: 'c' }) as never);
    await curriculumService.update('c', { title: 'New', grade: 'Grade 3' } as never);
    expect((upd.mock.calls[0][1] as any).$set).toEqual({ title: 'New', grade: 'Grade 3', level: 'GRADE' });
  });

  it('listAdminOverview() orders by grade then subject and counts chapters and topics', async () => {
    jest.spyOn(CurriculumModel, 'find').mockReturnValue(lean([
      { publicId: '3', title: 'HS', subject: 'Science', grade: 'High School', level: 'HIGH_SCHOOL', isPublished: false, chapters: [] },
      { publicId: '2', title: 'S3', subject: 'Science', grade: 'Grade 3', level: 'GRADE', isPublished: true, chapters: [{ publicId: 'a', topics: [{ publicId: 'x' }, { publicId: 'y' }] }] },
      { publicId: '1', title: 'M3', subject: 'Mathematics', grade: 'Grade 3', level: 'GRADE', isPublished: true, chapters: [] },
      { publicId: '0', title: 'K', subject: 'Mathematics', grade: 'Kindergarten', level: 'KINDERGARTEN', isPublished: false, chapters: [] },
    ]) as never);
    const out = await curriculumService.listAdminOverview('CO');
    expect(out.map((c) => c.publicId)).toEqual(['0', '1', '2', '3']);
    expect(out[2]).toMatchObject({ chapterCount: 1, topicCount: 2 });
  });

  it('listAdminStates() maps the aggregate', async () => {
    const agg = jest.spyOn(CurriculumModel, 'aggregate').mockResolvedValue([{ _id: 'CO', total: 3, published: 1 }] as never);
    expect(await curriculumService.listAdminStates()).toEqual([{ stateCode: 'CO', total: 3, published: 1 }]);
    // leftover curricula without a state (old district ones) must not form a group
    expect((agg.mock.calls[0][0] as any[])[0].$match).toMatchObject({ stateCode: { $exists: true, $ne: null } });
  });

  it('getByPublicId() with forStudent projects out import metadata', async () => {
    const fo = jest.spyOn(CurriculumModel, 'findOne').mockReturnValue(lean({ publicId: 'c' }) as never);
    await curriculumService.getByPublicId('c', { forStudent: true });
    expect((fo.mock.calls as any[][])[0][1]).toEqual({ sourceKind: 0, createdByAdminPublicId: 0 });
  });
});
