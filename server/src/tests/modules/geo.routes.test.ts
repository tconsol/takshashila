import request from 'supertest';
import app from '../../app';
import { courseService } from '../../modules/courses/course.service';

// Same auth stub as course-request.routes.test.ts; role is ADMIN so course create is allowed.
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
});

describe('POST /courses location validation', () => {
  afterEach(() => jest.restoreAllMocks());

  const body = { grade: 'Grade 8', subject: 'Math', title: 'Algebra I', topics: [] };

  it('422s a county that is not in the given state', async () => {
    const createSpy = jest.spyOn(courseService, 'create');
    const res = await request(app).post('/api/v1/courses').send({ ...body, state: 'VA', countyFips: '37183' });
    expect(res.status).toBe(422);
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('accepts a valid state/county pair and defaults country to US', async () => {
    const createSpy = jest.spyOn(courseService, 'create').mockResolvedValue({ publicId: 'c-1' } as never);
    const res = await request(app).post('/api/v1/courses').send({ ...body, state: 'NC', countyFips: '37183' });
    expect(res.status).toBe(201);
    expect(createSpy).toHaveBeenCalledWith('admin-1', expect.objectContaining({ country: 'US', state: 'NC', countyFips: '37183' }));
  });
});
