import { curriculumController } from '../../modules/curricula/curriculum.controller';
import { curriculumService } from '../../modules/curricula/curriculum.service';
import type { AuthRequest } from '../../shared/types';
import type { Response } from 'express';

const buildReq = (query: Record<string, unknown> = {}) =>
  ({ user: { role: 'ADMIN', publicId: 'user-1' }, query, params: {}, body: {} } as unknown as AuthRequest);

const buildRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as unknown as Response);

describe('CurriculumController admin overview', () => {
  afterEach(() => jest.restoreAllMocks());

  it('adminStates returns the states that have curricula', async () => {
    const spy = jest.spyOn(curriculumService, 'listAdminStates').mockResolvedValue([{ stateCode: 'CO', total: 2, published: 1 }]);
    const res = buildRes();
    await curriculumController.adminStates(buildReq(), res, jest.fn());
    expect(spy).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: [{ stateCode: 'CO', total: 2, published: 1 }] }));
  });

  it('adminOverview passes the state code to the service', async () => {
    const spy = jest.spyOn(curriculumService, 'listAdminOverview').mockResolvedValue([]);
    await curriculumController.adminOverview(buildReq({ stateCode: 'CO' }), buildRes(), jest.fn());
    expect(spy).toHaveBeenCalledWith('CO');
  });

  it('adminOverview rejects a missing or unknown state code', async () => {
    const spy = jest.spyOn(curriculumService, 'listAdminOverview').mockResolvedValue([]);
    const next = jest.fn();
    await curriculumController.adminOverview(buildReq(), buildRes(), next);
    await curriculumController.adminOverview(buildReq({ stateCode: 'ZZ' }), buildRes(), next);
    expect(spy).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(2);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 422 }));
  });
});
