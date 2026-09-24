import request from 'supertest';
import app from '../../app'; // app.ts uses `export default app;` — not a named export
import { courseService } from '../../modules/courses/course.service';

// No other module in this repo has a `*.routes.test.ts` (confirmed by search —
// only `class.*.test.ts`, `course.model.test.ts`, etc. exist at this
// layer), so there is no existing auth-bypass convention to mirror. This
// suite mocks the auth middleware directly, which is the simplest approach
// consistent with how every other test in this repo mocks singleton
// services/models with `jest.spyOn` rather than standing up a real server.
// app.ts eagerly mounts every module's routes, and several other modules
// (e.g. notifications) import `requireAuth` from this same file — jest.mock
// replaces the whole module, so both exports must be stubbed or those other
// routers blow up at import time with "Router.use() requires a middleware
// function".
jest.mock('../../middlewares/auth.middleware', () => {
  const stub = (req: never, _res: never, next: () => void) => {
    (req as { user: unknown }).user = { publicId: 'user-1', role: 'STUDENT' };
    next();
  };
  return {
    authMiddleware: stub,
    requireAuth: stub,
    optionalAuth: (req: never, _res: never, next: () => void) => {
      (req as { user: unknown }).user = { publicId: 'user-1', role: 'STUDENT' };
      next();
    },
  };
});

describe('POST /courses', () => {
  it('rejects a request with no selected topics (validator)', async () => {
    const res = await request(app)
      .post('/api/v1/courses')
      .send({
        curriculumPublicId: 'curriculum-1',
        topicPublicIds: [],
        tutorPublicId: 'tutor-1',
        availabilityWindow: { daysOfWeek: [1], startLocalTime: '16:00', endLocalTime: '19:00', ianaTimezone: 'UTC' },
      });
    // The brief's test asserted 400 here, but this repo's `validate` middleware
    // raises `ValidationError`, which the shared error middleware maps to 422
    // everywhere else (see src/tests/smoke/api.smoke.test.ts's "422 (validation)"
    // cases) — 400 was never this route's real behavior, so the assertion is
    // corrected to match the repo-wide convention rather than the stale brief.
    expect(res.status).toBe(422);
  });

  it('creates a request and returns 201 for a valid payload', async () => {
    jest.spyOn(courseService, 'create').mockResolvedValue({ publicId: 'cr-1' } as never);
    const res = await request(app)
      .post('/api/v1/courses')
      .send({
        curriculumPublicId: 'curriculum-1',
        topicPublicIds: ['topic-1'],
        tutorPublicId: 'tutor-1',
        availabilityWindow: { daysOfWeek: [1], startLocalTime: '16:00', endLocalTime: '19:00', ianaTimezone: 'UTC' },
      });
    expect(res.status).toBe(201);
    expect(res.body.data.publicId).toBe('cr-1');
  });
});
