import request from 'supertest';
import express from 'express';
import { supportRouter } from '../../modules/support/support.routes';
import { errorMiddleware } from '../../middlewares/error.middleware';
import { supportService } from '../../modules/support/support.service';
import { TicketModel } from '../../modules/support/support.model';

jest.mock('../../middlewares/auth.middleware', () => {
  const stub = (req: { headers: Record<string, string>; user?: unknown }, _res: never, next: () => void) => {
    req.user = { publicId: req.headers['x-test-user'] ?? 'user-1', role: req.headers['x-test-role'] ?? 'STUDENT' };
    next();
  };
  return { authMiddleware: stub, requireAuth: stub, optionalAuth: stub };
});

const app = express();
app.use(express.json());
app.use('/api/v1/support', supportRouter);
app.use(errorMiddleware);

const TICKET = { publicId: 't1', requesterPublicId: 'owner' };

describe('SupportService.assertCanAccess', () => {
  beforeEach(() => {
    jest.spyOn(TicketModel, 'findOne').mockReturnValue({ lean: () => Promise.resolve(TICKET) } as never);
  });
  it('lets the requester in', async () => {
    await expect(supportService.assertCanAccess('t1', 'owner', false)).resolves.toBeUndefined();
  });
  it('returns 404 for a different non-staff user', async () => {
    await expect(supportService.assertCanAccess('t1', 'other', false)).rejects.toMatchObject({ statusCode: 404 });
  });
  it('lets staff in', async () => {
    await expect(supportService.assertCanAccess('t1', 'agent', true)).resolves.toBeUndefined();
  });
  it('404s when the ticket does not exist', async () => {
    (TicketModel.findOne as jest.Mock).mockReturnValue({ lean: () => Promise.resolve(null) });
    await expect(supportService.assertCanAccess('zz', 'owner', true)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('support routes', () => {
  let addMessage: jest.SpyInstance;
  beforeEach(() => {
    jest.spyOn(TicketModel, 'findOne').mockReturnValue({ lean: () => Promise.resolve(TICKET) } as never);
    jest.spyOn(supportService, 'getMessages').mockResolvedValue([] as never);
    addMessage = jest.spyOn(supportService, 'addMessage').mockResolvedValue({ publicId: 'm1' } as never);
  });

  it('owner can GET ticket', async () => {
    const res = await request(app).get('/api/v1/support/tickets/t1').set('x-test-user', 'owner');
    expect(res.status).toBe(200);
  });
  it('other user gets 404 on GET ticket', async () => {
    const res = await request(app).get('/api/v1/support/tickets/t1').set('x-test-user', 'other');
    expect(res.status).toBe(404);
  });
  it('staff can GET ticket', async () => {
    const res = await request(app).get('/api/v1/support/tickets/t1').set('x-test-user', 'agent').set('x-test-role', 'SUPPORT');
    expect(res.status).toBe(200);
  });
  it('other user gets 404 on GET messages and service is not called', async () => {
    const res = await request(app).get('/api/v1/support/tickets/t1/messages').set('x-test-user', 'other');
    expect(res.status).toBe(404);
    expect(supportService.getMessages).not.toHaveBeenCalled();
  });
  it('owner GET messages excludes internal; staff includes internal', async () => {
    await request(app).get('/api/v1/support/tickets/t1/messages').set('x-test-user', 'owner');
    expect(supportService.getMessages).toHaveBeenLastCalledWith('t1', false);
    await request(app).get('/api/v1/support/tickets/t1/messages').set('x-test-user', 'a').set('x-test-role', 'ADMIN');
    expect(supportService.getMessages).toHaveBeenLastCalledWith('t1', true);
  });
  it('other user cannot post a message (404)', async () => {
    const res = await request(app).post('/api/v1/support/tickets/t1/messages').set('x-test-user', 'other').send({ body: 'hi' });
    expect(res.status).toBe(404);
    expect(addMessage).not.toHaveBeenCalled();
  });
  it('non-staff owner internal flag is forced to false', async () => {
    const res = await request(app).post('/api/v1/support/tickets/t1/messages').set('x-test-user', 'owner').send({ body: 'hi', isInternal: true });
    expect(res.status).toBe(201);
    expect(addMessage).toHaveBeenCalledWith('t1', 'owner', expect.objectContaining({ isInternal: false }));
  });
  it('staff may post internal notes', async () => {
    const res = await request(app).post('/api/v1/support/tickets/t1/messages')
      .set('x-test-user', 'agent').set('x-test-role', 'SUPPORT').send({ body: 'note', isInternal: true });
    expect(res.status).toBe(201);
    expect(addMessage).toHaveBeenCalledWith('t1', 'agent', expect.objectContaining({ isInternal: true }));
  });
});
