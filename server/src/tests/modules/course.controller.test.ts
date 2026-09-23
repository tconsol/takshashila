import { courseController } from '../../modules/courses/course.controller';
import { courseService } from '../../modules/courses/course.service';
import type { AuthRequest } from '../../shared/types';
import type { Response, NextFunction } from 'express';

const buildReq = (role: string, query: Record<string, unknown> = {}) =>
  ({ user: { role, publicId: 'user-1' }, query, params: {}, body: {} } as unknown as AuthRequest);

const buildRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as unknown as Response);

describe('CourseController.list', () => {
  afterEach(() => jest.restoreAllMocks());

  it('calls listCatalog (not listForAdmin) for a non-admin role like STUDENT', async () => {
    const catalogSpy = jest.spyOn(courseService, 'listCatalog').mockResolvedValue([] as never);
    const adminSpy = jest.spyOn(courseService, 'listForAdmin').mockResolvedValue({} as never);
    const next: NextFunction = jest.fn();

    await courseController.list(buildReq('STUDENT'), buildRes(), next);

    expect(catalogSpy).toHaveBeenCalled();
    expect(adminSpy).not.toHaveBeenCalled();
  });

  it('calls listForAdmin (not listCatalog) for role ADMIN', async () => {
    const catalogSpy = jest.spyOn(courseService, 'listCatalog').mockResolvedValue([] as never);
    const adminSpy = jest.spyOn(courseService, 'listForAdmin').mockResolvedValue({} as never);
    const next: NextFunction = jest.fn();

    await courseController.list(buildReq('ADMIN'), buildRes(), next);

    expect(adminSpy).toHaveBeenCalled();
    expect(catalogSpy).not.toHaveBeenCalled();
  });

  it('calls listForAdmin (not listCatalog) for role SUPER_ADMIN', async () => {
    const catalogSpy = jest.spyOn(courseService, 'listCatalog').mockResolvedValue([] as never);
    const adminSpy = jest.spyOn(courseService, 'listForAdmin').mockResolvedValue({} as never);
    const next: NextFunction = jest.fn();

    await courseController.list(buildReq('SUPER_ADMIN'), buildRes(), next);

    expect(adminSpy).toHaveBeenCalled();
    expect(catalogSpy).not.toHaveBeenCalled();
  });
});
