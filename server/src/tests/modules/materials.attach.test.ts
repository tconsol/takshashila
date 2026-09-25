// server/src/tests/modules/materials.attach.test.ts
import request from 'supertest';
import app from '../../app';
import { CurriculumModel } from '../../modules/curricula/curriculum.model';
import { tutorService } from '../../modules/tutors/tutor.service';
import {
  listAttachableCurricula, resolveTutorAttachment, resolveAdminAttachment,
} from '../../modules/curricula/curriculum-attachment';
import { ResourceModel } from '../../modules/resources/resource.model';
import { AssignmentModel } from '../../modules/assignments/assignment.model';
import { WorksheetModel } from '../../modules/worksheets/worksheet.model';

jest.mock('../../middlewares/auth.middleware', () => {
  const stub = (req: never, _res: never, next: () => void) => {
    (req as { user: unknown }).user = { publicId: 'tutor-user-1', role: 'TUTOR' };
    next();
  };
  return { authMiddleware: stub, requireAuth: stub, optionalAuth: stub };
});

const chain = (v: unknown) => ({ sort: () => ({ limit: () => ({ lean: () => Promise.resolve(v) }) }) });
const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });
const algebra = {
  publicId: 'cur-1', title: 'Algebra I', subject: 'Mathematics', grade: 'Grade 8', district: 'Wake', state: 'NC',
  isPublished: true, isDeleted: false,
  topics: [{ publicId: 't-1', title: 'Linear', order: 0 }, { publicId: 't-2', title: 'Quadratic', order: 1 }],
};
const tutor = { publicId: 'tp-1', subjects: ['mathematics'], gradesTaught: ['Grade 8'] };

describe('material models', () => {
  it('carry curriculum attachment fields and no longer require a tutor', () => {
    for (const M of [ResourceModel, AssignmentModel, WorksheetModel] as const) {
      const paths = M.schema.paths as Record<string, { isRequired?: boolean }>;
      expect(Object.keys(paths)).toEqual(expect.arrayContaining(['curriculumPublicId', 'topicPublicIds', 'authorRole', 'authorUserPublicId']));
      expect(paths.tutorPublicId.isRequired).toBeFalsy();
    }
    expect((AssignmentModel.schema.paths as Record<string, { isRequired?: boolean }>).classPublicId.isRequired).toBeFalsy();
    expect((AssignmentModel.schema.paths as Record<string, { isRequired?: boolean }>).dueDate.isRequired).toBeFalsy();
  });

  it('curriculum topics no longer hold material id lists', () => {
    const paths = Object.keys(CurriculumModel.schema.paths);
    expect(paths.some((p) => /resourceIds|assignmentIds|worksheetIds/.test(p))).toBe(false);
  });
});

describe('listAttachableCurricula', () => {
  afterEach(() => jest.restoreAllMocks());

  it('queries published curricula matching the tutor subjects (case-insensitive) and grades', async () => {
    const findSpy = jest.spyOn(CurriculumModel, 'find').mockReturnValue(chain([algebra]) as never);
    const result = await listAttachableCurricula(tutor);
    const filter = (findSpy.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(filter).toEqual(expect.objectContaining({ isPublished: true, isDeleted: false, grade: { $in: ['Grade 8'] } }));
    const subjects = (filter.subject as { $in: RegExp[] }).$in;
    expect(subjects.some((r) => r.test('Mathematics'))).toBe(true);
    expect(result[0]).toEqual({
      publicId: 'cur-1', title: 'Algebra I', subject: 'Mathematics', grade: 'Grade 8', district: 'Wake', state: 'NC',
      topics: [{ publicId: 't-1', title: 'Linear', order: 0 }, { publicId: 't-2', title: 'Quadratic', order: 1 }],
    });
  });

  it('does not filter by grade when the tutor teaches every grade', async () => {
    const findSpy = jest.spyOn(CurriculumModel, 'find').mockReturnValue(chain([]) as never);
    await listAttachableCurricula({ subjects: ['Mathematics'], gradesTaught: [] });
    expect((findSpy.mock.calls[0] as unknown as [Record<string, unknown>])[0]).not.toHaveProperty('grade');
  });

  it('returns nothing without querying when the tutor has no subjects', async () => {
    const findSpy = jest.spyOn(CurriculumModel, 'find');
    expect(await listAttachableCurricula({ subjects: [] })).toEqual([]);
    expect(findSpy).not.toHaveBeenCalled();
  });
});

describe('resolveTutorAttachment', () => {
  afterEach(() => jest.restoreAllMocks());

  it('requires a curriculum and at least one topic', async () => {
    await expect(resolveTutorAttachment(tutor, {})).rejects.toMatchObject({ statusCode: 422 });
    await expect(resolveTutorAttachment(tutor, { curriculumPublicId: 'cur-1', topicPublicIds: [] })).rejects.toMatchObject({ statusCode: 422 });
  });

  it('rejects a curriculum the tutor cannot attach to', async () => {
    jest.spyOn(CurriculumModel, 'findOne').mockReturnValue(lean({ ...algebra, subject: 'History' }) as never);
    await expect(resolveTutorAttachment(tutor, { curriculumPublicId: 'cur-1', topicPublicIds: ['t-1'] }))
      .rejects.toMatchObject({ statusCode: 422 });
  });

  it('rejects an unpublished curriculum and a grade the tutor does not teach', async () => {
    jest.spyOn(CurriculumModel, 'findOne').mockReturnValue(lean(null) as never);
    await expect(resolveTutorAttachment(tutor, { curriculumPublicId: 'cur-1', topicPublicIds: ['t-1'] }))
      .rejects.toMatchObject({ statusCode: 422 });
    jest.spyOn(CurriculumModel, 'findOne').mockReturnValue(lean({ ...algebra, grade: 'Grade 3' }) as never);
    await expect(resolveTutorAttachment(tutor, { curriculumPublicId: 'cur-1', topicPublicIds: ['t-1'] }))
      .rejects.toMatchObject({ statusCode: 422 });
  });

  it('rejects topics that are not in the curriculum', async () => {
    jest.spyOn(CurriculumModel, 'findOne').mockReturnValue(lean(algebra) as never);
    await expect(resolveTutorAttachment(tutor, { curriculumPublicId: 'cur-1', topicPublicIds: ['t-1', 't-9'] }))
      .rejects.toMatchObject({ statusCode: 422 });
  });

  it('returns de-duplicated attachment fields for a valid choice', async () => {
    const findOne = jest.spyOn(CurriculumModel, 'findOne').mockReturnValue(lean(algebra) as never);
    expect(await resolveTutorAttachment(tutor, { curriculumPublicId: 'cur-1', topicPublicIds: ['t-2', 't-1', 't-2'] }))
      .toEqual({ curriculumPublicId: 'cur-1', topicPublicIds: ['t-2', 't-1'] });
    expect(findOne).toHaveBeenCalledWith({ publicId: 'cur-1', isPublished: true, isDeleted: false });
  });
});

describe('resolveAdminAttachment', () => {
  afterEach(() => jest.restoreAllMocks());

  it('404s an unknown curriculum, 422s bad topics, accepts unpublished curricula', async () => {
    jest.spyOn(CurriculumModel, 'findOne').mockReturnValue(lean(null) as never);
    await expect(resolveAdminAttachment('nope', ['t-1'])).rejects.toMatchObject({ statusCode: 404 });
    jest.spyOn(CurriculumModel, 'findOne').mockReturnValue(lean({ ...algebra, isPublished: false }) as never);
    await expect(resolveAdminAttachment('cur-1', [])).rejects.toMatchObject({ statusCode: 422 });
    expect(await resolveAdminAttachment('cur-1', ['t-1'])).toEqual({ curriculumPublicId: 'cur-1', topicPublicIds: ['t-1'] });
  });
});

describe('GET /curricula/attachable', () => {
  afterEach(() => jest.restoreAllMocks());

  it('lists attachable curricula for the calling tutor', async () => {
    jest.spyOn(tutorService, 'getByUserPublicId').mockResolvedValue(tutor as never);
    jest.spyOn(CurriculumModel, 'find').mockReturnValue(chain([algebra]) as never);
    const res = await request(app).get('/api/v1/curricula/attachable');
    expect(res.status).toBe(200);
    expect(res.body.data[0].publicId).toBe('cur-1');
  });
});
import { resourceService } from '../../modules/resources/resource.service';
import { assignmentService } from '../../modules/assignments/assignment.service';
import { worksheetService } from '../../modules/worksheets/worksheet.service';

const author = { publicId: 'tp-1', userPublicId: 'tutor-user-1', subjects: ['Mathematics'], gradesTaught: ['Grade 8'] };
const attach = { curriculumPublicId: 'cur-1', topicPublicIds: ['t-1'] };

describe('tutor create attaches to a curriculum', () => {
  beforeEach(() => jest.spyOn(CurriculumModel, 'findOne').mockReturnValue(lean(algebra) as never));
  afterEach(() => jest.restoreAllMocks());

  it('resource', async () => {
    const create = jest.spyOn(ResourceModel, 'create').mockResolvedValue({ toObject: () => ({}) } as never);
    await resourceService.create(author, { title: 'Notes', mediaPublicId: 'm', fileName: 'a.pdf', mimeType: 'application/pdf', sizeBytes: 1, ...attach });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      tutorPublicId: 'tp-1', curriculumPublicId: 'cur-1', topicPublicIds: ['t-1'], authorRole: 'TUTOR', authorUserPublicId: 'tutor-user-1',
    }));
  });

  it('assignment', async () => {
    const create = jest.spyOn(AssignmentModel, 'create').mockResolvedValue({ toObject: () => ({}) } as never);
    await assignmentService.create({ classPublicId: 'c-1', title: 'HW', description: 'Do it now', dueDate: '2026-10-01T10:00:00Z', ...attach }, author);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ curriculumPublicId: 'cur-1', authorRole: 'TUTOR' }));
  });

  it('worksheet', async () => {
    const create = jest.spyOn(WorksheetModel, 'create').mockResolvedValue({ toObject: () => ({}) } as never);
    await worksheetService.create(author, {
      title: 'Quiz', type: 'WORKSHEET',
      questions: [{ questionText: 'Q', options: ['a', 'b', 'c', 'd'], correctIndex: 0, explanation: '' }],
      ...attach,
    } as never);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ topicPublicIds: ['t-1'], authorRole: 'TUTOR' }));
  });

  it('rejects creation without a curriculum', async () => {
    const create = jest.spyOn(ResourceModel, 'create');
    await expect(resourceService.create(author, { title: 'x', mediaPublicId: 'm', fileName: 'a', mimeType: 'a', sizeBytes: 1 }))
      .rejects.toMatchObject({ statusCode: 422 });
    expect(create).not.toHaveBeenCalled();
  });
});
