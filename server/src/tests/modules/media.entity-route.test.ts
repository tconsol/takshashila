import request from 'supertest';
import express from 'express';
import mediaRoutes from '../../modules/media/media.routes';
import { errorMiddleware } from '../../middlewares/error.middleware';
import { mediaService } from '../../modules/media/media.service';
import { canReadMedia } from '../../modules/media/media-access';

jest.mock('../../middlewares/auth.middleware', () => {
  const stub = (req: { headers: Record<string, string>; user?: unknown }, _res: never, next: () => void) => {
    req.user = { publicId: req.headers['x-test-user'] ?? 'user-1', role: req.headers['x-test-role'] ?? 'STUDENT' };
    next();
  };
  return { authMiddleware: stub, requireAuth: stub, optionalAuth: stub };
});
jest.mock('../../modules/media/media-access', () => ({ canReadMedia: jest.fn() }));

const app = express();
app.use(express.json());
app.use('/api/v1/media', mediaRoutes);
app.use(errorMiddleware);

describe('GET /media/entity/:entityId', () => {
  beforeEach(() => {
    jest.spyOn(mediaService, 'getByEntity').mockResolvedValue([
      { publicId: 'a', fileName: 'a.pdf', gcsObjectKey: 'secret/a' },
      { publicId: 'b', fileName: 'b.pdf', gcsObjectKey: 'secret/b' },
    ] as never);
  });

  it('returns only readable files and strips gcsObjectKey', async () => {
    (canReadMedia as jest.Mock).mockImplementation(async (_v, id: string) => id === 'a');
    const res = await request(app).get('/api/v1/media/entity/e1');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ publicId: 'a', fileName: 'a.pdf' }]);
    expect(JSON.stringify(res.body)).not.toContain('secret');
    expect(canReadMedia).toHaveBeenCalledWith({ role: 'STUDENT', userPublicId: 'user-1' }, 'a');
  });

  it('returns an empty list when nothing is readable', async () => {
    (canReadMedia as jest.Mock).mockResolvedValue(false);
    const res = await request(app).get('/api/v1/media/entity/e1');
    expect(res.body.data).toEqual([]);
  });

  it('strips gcsObjectKey even when everything is readable', async () => {
    (canReadMedia as jest.Mock).mockResolvedValue(true);
    const res = await request(app).get('/api/v1/media/entity/e1');
    expect(res.body.data).toHaveLength(2);
    res.body.data.forEach((f: Record<string, unknown>) => expect(f).not.toHaveProperty('gcsObjectKey'));
  });
});
