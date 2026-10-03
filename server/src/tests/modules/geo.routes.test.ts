import request from 'supertest';
import app from '../../app';
import { curriculumService } from '../../modules/curricula/curriculum.service';

// Same auth stub as course.routes.test.ts; role is ADMIN so curriculum create is allowed.
jest.mock('../../middlewares/auth.middleware', () => {
  const stub = (req: never, _res: never, next: () => void) => {
    (req as { user: unknown }).user = { publicId: 'admin-1', role: 'ADMIN' };
    next();
  };
  return { authMiddleware: stub, requireAuth: stub, optionalAuth: stub };
});

describe('GET /geo', () => {
  it('lists countries (US only) and states', async () => {
    const countries = await request(app).get('/api/v1/geo/countries');
    expect(countries.status).toBe(200);
    expect(countries.body.data).toEqual([{ code: 'US', name: 'United States' }]);

    const states = await request(app).get('/api/v1/geo/states');
    expect(states.status).toBe(200);
    expect(states.body.data).toHaveLength(51);
    expect(states.headers['cache-control']).toContain('max-age=86400');
  });

  it('lists a state\'s counties, case-insensitively, and 404s an unknown state', async () => {
    const res = await request(app).get('/api/v1/geo/states/nc/counties');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(100);

    const bad = await request(app).get('/api/v1/geo/states/ZZ/counties');
    expect(bad.status).toBe(404);
  });

  it('lists districts for a state, filters by county, 404s an unknown state, 422s a county outside the state', async () => {
    const all = await request(app).get('/api/v1/geo/states/nc/districts');
    expect(all.status).toBe(200);
    expect(all.body.data.length).toBeGreaterThan(100);

    const wake = await request(app).get('/api/v1/geo/states/NC/districts?countyFips=37183');
    expect(wake.status).toBe(200);
    expect(wake.body.data).toEqual([{ id: '3704720', name: 'Wake County Schools', state: 'NC', countyFips: '37183' }]);

    expect((await request(app).get('/api/v1/geo/states/ZZ/districts')).status).toBe(404);
    expect((await request(app).get('/api/v1/geo/states/VA/districts?countyFips=37183')).status).toBe(422);
  });
});

describe('POST /curricula state validation', () => {
  afterEach(() => jest.restoreAllMocks());

  const body = { grade: 'Grade 8', subject: 'Math', title: 'Algebra I', chapters: [] };

  it('422s an unknown state', async () => {
    const createSpy = jest.spyOn(curriculumService, 'create');
    const res = await request(app).post('/api/v1/curricula').send({ ...body, stateCode: 'ZZ' });
    expect(res.status).toBe(422);
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('422s a request that names a school district instead of a state', async () => {
    const createSpy = jest.spyOn(curriculumService, 'create');
    const res = await request(app).post('/api/v1/curricula').send({ ...body, districtId: '3704720' });
    expect(res.status).toBe(422);
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('accepts a valid state and strips client-sent district and county fields', async () => {
    const createSpy = jest.spyOn(curriculumService, 'create').mockResolvedValue({ publicId: 'c-1' } as never);
    const res = await request(app).post('/api/v1/curricula').send({ ...body, stateCode: 'CO', districtId: '3704720', countyFips: '51059' });
    expect(res.status).toBe(201);
    const dto = createSpy.mock.calls[0][1] as unknown as Record<string, unknown>;
    expect(dto.stateCode).toBe('CO');
    expect(dto.districtId).toBeUndefined();
    expect(dto.countyFips).toBeUndefined();
  });
});
