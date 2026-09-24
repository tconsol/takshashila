import { curriculumController } from '../../modules/curricula/curriculum.controller';
import { curriculumService } from '../../modules/curricula/curriculum.service';
import type { AuthRequest } from '../../shared/types';
import type { Response, NextFunction } from 'express';

const buildReq = (role: string, query: Record<string, unknown> = {}) =>
  ({ user: { role, publicId: 'user-1' }, query, params: {}, body: {} } as unknown as AuthRequest);

const buildRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as unknown as Response);

describe('CurriculumController.list', () => {
  afterEach(() => jest.restoreAllMocks());

  it('calls listCatalog (not listForAdmin) for a non-admin role like STUDENT', async () => {
    const catalogSpy = jest.spyOn(curriculumService, 'listCatalog').mockResolvedValue([] as never);
    const adminSpy = jest.spyOn(curriculumService, 'listForAdmin').mockResolvedValue({} as never);
    const next: NextFunction = jest.fn();

    await curriculumController.list(buildReq('STUDENT', { districtId: '3704720' }), buildRes(), next);

    expect(catalogSpy).toHaveBeenCalled();
    expect(adminSpy).not.toHaveBeenCalled();
  });

  it('calls listForAdmin (not listCatalog) for role ADMIN', async () => {
    const catalogSpy = jest.spyOn(curriculumService, 'listCatalog').mockResolvedValue([] as never);
    const adminSpy = jest.spyOn(curriculumService, 'listForAdmin').mockResolvedValue({} as never);
    const next: NextFunction = jest.fn();

    await curriculumController.list(buildReq('ADMIN'), buildRes(), next);

    expect(adminSpy).toHaveBeenCalled();
    expect(catalogSpy).not.toHaveBeenCalled();
  });

  it('calls listForAdmin (not listCatalog) for role SUPER_ADMIN', async () => {
    const catalogSpy = jest.spyOn(curriculumService, 'listCatalog').mockResolvedValue([] as never);
    const adminSpy = jest.spyOn(curriculumService, 'listForAdmin').mockResolvedValue({} as never);
    const next: NextFunction = jest.fn();

    await curriculumController.list(buildReq('SUPER_ADMIN'), buildRes(), next);

    expect(adminSpy).toHaveBeenCalled();
    expect(catalogSpy).not.toHaveBeenCalled();
  });

  it('rejects a STUDENT catalog request without districtId (never an unscoped list)', async () => {
    const catalogSpy = jest.spyOn(curriculumService, 'listCatalog').mockResolvedValue([] as never);
    const next = jest.fn();

    await curriculumController.list(buildReq('STUDENT'), buildRes(), next);

    expect(catalogSpy).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 422 }));
  });

  it('passes districtId and optional grade through to listCatalog', async () => {
    const catalogSpy = jest.spyOn(curriculumService, 'listCatalog').mockResolvedValue([] as never);

    await curriculumController.list(buildReq('STUDENT', { districtId: '3704720' }), buildRes(), jest.fn());

    expect(catalogSpy).toHaveBeenCalledWith({ districtId: '3704720' });
  });
});
