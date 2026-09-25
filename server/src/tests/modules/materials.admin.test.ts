// server/src/tests/modules/materials.admin.test.ts
import request from 'supertest';
import app from '../../app';
import { CurriculumModel } from '../../modules/curricula/curriculum.model';
import { ResourceModel } from '../../modules/resources/resource.model';
import { AssignmentModel } from '../../modules/assignments/assignment.model';
import { WorksheetModel, WorksheetSubmissionModel } from '../../modules/worksheets/worksheet.model';
import { worksheetService } from '../../modules/worksheets/worksheet.service';
import { settingsService } from '../../modules/settings/settings.service';

let mockRole = 'ADMIN';
jest.mock('../../middlewares/auth.middleware', () => {
  const stub = (req: never, _res: never, next: () => void) => {
    (req as { user: unknown }).user = { publicId: 'admin-u', role: mockRole };
    next();
  };
  return { authMiddleware: stub, requireAuth: stub, optionalAuth: stub };
});

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });
const curriculum = { publicId: 'cur-1', isDeleted: false, topics: [{ publicId: 't-1' }, { publicId: 't-2' }] };

describe('admin curriculum materials', () => {
  beforeEach(() => {
    jest.spyOn(CurriculumModel, 'findOne').mockReturnValue(lean(curriculum) as never);
    // Writes pass through the maintenance middleware, which reads platform settings.
    jest.spyOn(settingsService, 'get').mockResolvedValue({ maintenanceMode: false } as never);
  });
  afterEach(() => { jest.restoreAllMocks(); mockRole = 'ADMIN'; });

  it('creates a resource as ADMIN-authored, no tutor', async () => {
    const create = jest.spyOn(ResourceModel, 'create').mockResolvedValue({ toObject: () => ({ publicId: 'r-1' }) } as never);
    const res = await request(app).post('/api/v1/curricula/cur-1/resources').send({
      title: 'Notes', mediaPublicId: 'm', fileName: 'a.pdf', mimeType: 'application/pdf', sizeBytes: 10, topicPublicIds: ['t-1'],
    });
    expect(res.status).toBe(201);
    const arg = (create.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(arg).toEqual(expect.objectContaining({ curriculumPublicId: 'cur-1', topicPublicIds: ['t-1'], authorRole: 'ADMIN', authorUserPublicId: 'admin-u' }));
    expect(arg.tutorPublicId).toBeUndefined();
  });

  it('creates assignments and worksheets PUBLISHED immediately', async () => {
    const aCreate = jest.spyOn(AssignmentModel, 'create').mockResolvedValue({ toObject: () => ({}) } as never);
    const wCreate = jest.spyOn(WorksheetModel, 'create').mockResolvedValue({ toObject: () => ({}) } as never);
    await request(app).post('/api/v1/curricula/cur-1/assignments').send({ title: 'HW', description: 'Solve these', topicPublicIds: ['t-2'] });
    await request(app).post('/api/v1/curricula/cur-1/worksheets').send({
      title: 'Quiz', type: 'WORKSHEET', topicPublicIds: ['t-1'],
      questions: [{ questionText: 'Q', options: ['a', 'b', 'c', 'd'], correctIndex: 1, explanation: '' }],
    });
    expect(aCreate).toHaveBeenCalledWith(expect.objectContaining({ status: 'PUBLISHED', authorRole: 'ADMIN' }));
    expect(wCreate).toHaveBeenCalledWith(expect.objectContaining({ status: 'PUBLISHED', authorRole: 'ADMIN', assignedToStudentPublicIds: [] }));
  });

  it('422s topics outside the curriculum and 403s non-admins', async () => {
    const res = await request(app).post('/api/v1/curricula/cur-1/resources').send({
      title: 'x', mediaPublicId: 'm', fileName: 'a', mimeType: 'a', sizeBytes: 1, topicPublicIds: ['t-9'],
    });
    expect(res.status).toBe(422);
    mockRole = 'TUTOR';
    expect((await request(app).post('/api/v1/curricula/cur-1/resources').send({})).status).toBe(403);
  });

  it('deletes only admin-authored items of that curriculum', async () => {
    const upd = jest.spyOn(WorksheetModel, 'findOneAndUpdate').mockReturnValue(lean({ publicId: 'w-1' }) as never);
    const res = await request(app).delete('/api/v1/curricula/cur-1/materials/worksheet/w-1');
    expect(res.status).toBe(200);
    expect(upd).toHaveBeenCalledWith(
      { publicId: 'w-1', curriculumPublicId: 'cur-1', authorRole: 'ADMIN', isDeleted: false },
      { $set: { isDeleted: true } },
    );
  });
});

describe('admin worksheets stay out of generic student lists', () => {
  afterEach(() => jest.restoreAllMocks());

  it('getForStudent excludes ADMIN-authored worksheets', async () => {
    const find = jest.spyOn(WorksheetModel, 'find').mockReturnValue({ sort: () => ({ skip: () => ({ limit: () => lean([]) }) }) } as never);
    jest.spyOn(WorksheetModel, 'countDocuments').mockResolvedValue(0 as never);
    jest.spyOn(WorksheetSubmissionModel, 'find').mockReturnValue(lean([]) as never);
    await worksheetService.getForStudent('sp-1', {});
    expect(find).toHaveBeenCalledWith(expect.objectContaining({ authorRole: { $ne: 'ADMIN' } }));
  });
});
