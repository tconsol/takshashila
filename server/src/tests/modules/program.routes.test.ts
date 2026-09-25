// server/src/tests/modules/program.routes.test.ts
import request from 'supertest';
import app from '../../app';
import { programService } from '../../modules/programs/program.service';
import { programEnrollmentService } from '../../modules/programs/program-enrollment.service';
import { tutorService } from '../../modules/tutors/tutor.service';
import { settingsService } from '../../modules/settings/settings.service';

let mockRole = 'TUTOR';
jest.mock('../../middlewares/auth.middleware', () => {
  const stub = (req: never, _res: never, next: () => void) => {
    (req as { user: unknown }).user = { publicId: 'user-1', role: mockRole };
    next();
  };
  return { authMiddleware: stub, requireAuth: stub, optionalAuth: stub };
});

const body = { title: 'Chess', category: 'GAMES', level: 'BEGINNER', sessionCount: 4, priceCents: 4000, modules: [{ title: 'Openings' }] };

describe('/programs routes', () => {
  beforeEach(() => {
    jest.spyOn(settingsService, 'get').mockResolvedValue({ maintenanceMode: false } as never);
    jest.spyOn(tutorService, 'getByUserPublicId').mockResolvedValue({ publicId: 'tp-1' } as never);
  });
  afterEach(() => { jest.restoreAllMocks(); mockRole = 'TUTOR'; });

  it('tutor creates a program with a validated body; bad bodies 422', async () => {
    const create = jest.spyOn(programService, 'create').mockResolvedValue({ publicId: 'p-1' } as never);
    expect((await request(app).post('/api/v1/programs').send(body)).status).toBe(201);
    expect(create).toHaveBeenCalledWith('tp-1', expect.objectContaining({ title: 'Chess', sessionMinutes: 60 }));
    expect((await request(app).post('/api/v1/programs').send({ ...body, modules: [] })).status).toBe(422);
  });

  it('students cannot create programs; tutors cannot enroll', async () => {
    mockRole = 'STUDENT';
    expect((await request(app).post('/api/v1/programs').send(body)).status).toBe(403);
    mockRole = 'TUTOR';
    expect((await request(app).post('/api/v1/programs/p-1/enroll').send({})).status).toBe(403);
  });

  it('student enrolls with an availability window', async () => {
    mockRole = 'STUDENT';
    const enroll = jest.spyOn(programEnrollmentService, 'enroll').mockResolvedValue({ publicId: 'e-1' } as never);
    const res = await request(app).post('/api/v1/programs/p-1/enroll').send({
      availabilityWindow: { daysOfWeek: [1], startLocalTime: '16:00', endLocalTime: '18:00', ianaTimezone: 'UTC' },
    });
    expect(res.status).toBe(201);
    expect(enroll).toHaveBeenCalledWith('user-1', 'p-1', expect.anything());
  });

  it('catalog is open to any signed-in user and passes filters', async () => {
    mockRole = 'PARENT';
    const catalog = jest.spyOn(programService, 'catalog').mockResolvedValue({ items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } } as never);
    expect((await request(app).get('/api/v1/programs?category=GAMES&age=9')).status).toBe(200);
    expect(catalog).toHaveBeenCalledWith(expect.objectContaining({ category: 'GAMES', age: 9 }));
  });

  it('fixed paths are not captured by /:programPublicId', async () => {
    mockRole = 'STUDENT';
    const mine = jest.spyOn(programEnrollmentService, 'listMine').mockResolvedValue([]);
    expect((await request(app).get('/api/v1/programs/enrollments/mine')).status).toBe(200);
    expect(mine).toHaveBeenCalledWith('user-1');
  });

  it('admins unpublish', async () => {
    mockRole = 'ADMIN';
    const un = jest.spyOn(programService, 'unpublish').mockResolvedValue({ publicId: 'p-1' } as never);
    expect((await request(app).post('/api/v1/programs/p-1/unpublish')).status).toBe(200);
    expect(un).toHaveBeenCalledWith('p-1');
  });
});
