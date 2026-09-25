// server/src/tests/modules/materials.item-access.test.ts
import request from 'supertest';
import app from '../../app';
import * as access from '../../modules/courses/material-access';
import { resourceService } from '../../modules/resources/resource.service';
import { worksheetService } from '../../modules/worksheets/worksheet.service';
import { assignmentService } from '../../modules/assignments/assignment.service';
import { studentService } from '../../modules/students/student.service';
import { settingsService } from '../../modules/settings/settings.service';

jest.mock('../../middlewares/auth.middleware', () => {
  const stub = (req: never, _res: never, next: () => void) => {
    (req as { user: unknown }).user = { publicId: 'su-1', role: 'STUDENT' };
    next();
  };
  return { authMiddleware: stub, requireAuth: stub, optionalAuth: stub };
});

const curriculumItem = { publicId: 'x-1', title: 'T', curriculumPublicId: 'cur-1', topicPublicIds: ['t-1'], authorRole: 'ADMIN' };

describe('item endpoints gate curriculum materials', () => {
  // Writes pass through the maintenance middleware, which reads platform settings.
  beforeEach(() => jest.spyOn(settingsService, 'get').mockResolvedValue({ maintenanceMode: false } as never));
  afterEach(() => jest.restoreAllMocks());

  it('404s a resource, its read URL, a worksheet and an assignment the viewer may not see', async () => {
    jest.spyOn(access, 'canViewMaterial').mockResolvedValue(false);
    jest.spyOn(resourceService, 'getByPublicId').mockResolvedValue(curriculumItem as never);
    jest.spyOn(worksheetService, 'getByPublicId').mockResolvedValue(curriculumItem as never);
    jest.spyOn(assignmentService, 'getByPublicId').mockResolvedValue(curriculumItem as never);
    const readUrl = jest.spyOn(resourceService, 'getReadUrl');

    expect((await request(app).get('/api/v1/resources/x-1')).status).toBe(404);
    expect((await request(app).get('/api/v1/resources/x-1/read-url')).status).toBe(404);
    expect(readUrl).not.toHaveBeenCalled();
    expect((await request(app).get('/api/v1/worksheets/x-1')).status).toBe(404);
    expect((await request(app).get('/api/v1/assignments/x-1')).status).toBe(404);
  });

  it('blocks submitting to a curriculum worksheet/assignment the student may not see', async () => {
    jest.spyOn(access, 'canViewMaterial').mockResolvedValue(false);
    jest.spyOn(studentService, 'getByUserPublicId').mockResolvedValue({ publicId: 'sp-1' } as never);
    jest.spyOn(worksheetService, 'getByPublicId').mockResolvedValue(curriculumItem as never);
    jest.spyOn(assignmentService, 'getByPublicId').mockResolvedValue(curriculumItem as never);
    const wsSubmit = jest.spyOn(worksheetService, 'submitAnswers');
    const asSubmit = jest.spyOn(assignmentService, 'submit');

    expect((await request(app).post('/api/v1/worksheets/x-1/submit').send({ answers: [0] })).status).toBe(404);
    expect((await request(app).post('/api/v1/assignments/x-1/submit').send({ content: 'hi' })).status).toBe(404);
    expect(wsSubmit).not.toHaveBeenCalled();
    expect(asSubmit).not.toHaveBeenCalled();
  });

  it('allows the item when access is granted', async () => {
    jest.spyOn(access, 'canViewMaterial').mockResolvedValue(true);
    jest.spyOn(worksheetService, 'getByPublicId').mockResolvedValue(curriculumItem as never);
    expect((await request(app).get('/api/v1/worksheets/x-1')).status).toBe(200);
  });
});
