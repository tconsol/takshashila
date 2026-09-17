/* API smoke tests exercise the real Express app end-to-end through HTTP.
   These hit middleware that runs BEFORE the database (health, auth guards,
   request validation, 404 handling), so they verify the app is wired up
   correctly without needing a live MongoDB/Redis. */
import request from 'supertest';
import app from '../../app';

const BASE = '/api/v1';

describe('API smoke wiring, auth guards, validation', () => {
  it('GET /health → 200 ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
  });

  it('GET /api/v1/payments/config → 200 (public, returns key fields)', async () => {
    const res = await request(app).get(`${BASE}/payments/config`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('stripePublishableKey');
    expect(res.body).toHaveProperty('razorpayKeyId');
  });

  it('GET /api/v1/wallets/me without auth → 401', async () => {
    const res = await request(app).get(`${BASE}/wallets/me`);
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/classes/my/student without auth → 401', async () => {
    const res = await request(app).get(`${BASE}/classes/my/student`);
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/auth/login with empty body → 422 (validation)', async () => {
    const res = await request(app).post(`${BASE}/auth/login`).send({});
    expect(res.status).toBe(422);
  });

  it('POST /api/v1/auth/register with invalid email → 422 (validation)', async () => {
    const res = await request(app)
      .post(`${BASE}/auth/register`)
      .send({ email: 'not-an-email', password: 'x', firstName: 'A', lastName: 'B' });
    expect(res.status).toBe(422);
  });

  it('unknown route → 404', async () => {
    const res = await request(app).get(`${BASE}/this-route-does-not-exist`);
    expect(res.status).toBe(404);
  });
});
