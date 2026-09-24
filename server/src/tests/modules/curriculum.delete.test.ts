import request from 'supertest';
import app from '../../app';
import { curriculumService } from '../../modules/curricula/curriculum.service';
import { CurriculumModel } from '../../modules/curricula/curriculum.model';
import { CourseModel } from '../../modules/courses/course.model';
import { updateCurriculumSchema } from '../../modules/curricula/curriculum.validators';

// Role is switchable per test so the same app instance can be hit as ADMIN or STUDENT.
let mockRole = 'ADMIN';
jest.mock('../../middlewares/auth.middleware', () => {
  const stub = (req: never, _res: never, next: () => void) => {
    (req as { user: unknown }).user = { publicId: 'user-1', role: mockRole };
    next();
  };
  return { authMiddleware: stub, requireAuth: stub, optionalAuth: stub };
});

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });

describe('CurriculumService.softDelete', () => {
  afterEach(() => jest.restoreAllMocks());

  it('refuses while a PENDING or ACCEPTED request exists, and never touches the curriculum', async () => {
    jest.spyOn(CurriculumModel, 'findOne').mockReturnValue(lean({ publicId: 'curriculum-1' }) as never);
    const countSpy = jest.spyOn(CourseModel, 'countDocuments').mockResolvedValue(2 as never);
    const updateSpy = jest.spyOn(CurriculumModel, 'updateOne');

    await expect(curriculumService.softDelete('curriculum-1')).rejects.toMatchObject({ statusCode: 409 });

    expect(countSpy).toHaveBeenCalledWith({
      curriculumPublicId: 'curriculum-1',
      status: { $in: ['PENDING', 'ACCEPTED'] },
      isDeleted: false,
    });
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('soft-deletes and unpublishes when every request is finished', async () => {
    jest.spyOn(CurriculumModel, 'findOne').mockReturnValue(lean({ publicId: 'curriculum-1' }) as never);
    jest.spyOn(CourseModel, 'countDocuments').mockResolvedValue(0 as never);
    const updateSpy = jest.spyOn(CurriculumModel, 'updateOne').mockResolvedValue({} as never);

    await curriculumService.softDelete('curriculum-1');

    expect(updateSpy).toHaveBeenCalledWith(
      { publicId: 'curriculum-1', isDeleted: false },
      { $set: { isDeleted: true, isPublished: false } },
    );
  });

  it('404s a missing or already-deleted curriculum', async () => {
    jest.spyOn(CurriculumModel, 'findOne').mockReturnValue(lean(null) as never);
    await expect(curriculumService.softDelete('nope')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('DELETE /curricula/:curriculumPublicId', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    mockRole = 'ADMIN';
  });

  it('lets an ADMIN delete', async () => {
    const spy = jest.spyOn(curriculumService, 'softDelete').mockResolvedValue(undefined);
    const res = await request(app).delete('/api/v1/curricula/curriculum-1');
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledWith('curriculum-1');
  });

  it('lets a SUPER_ADMIN delete', async () => {
    mockRole = 'SUPER_ADMIN';
    jest.spyOn(curriculumService, 'softDelete').mockResolvedValue(undefined);
    expect((await request(app).delete('/api/v1/curricula/curriculum-1')).status).toBe(200);
  });

  it('403s a STUDENT', async () => {
    mockRole = 'STUDENT';
    const spy = jest.spyOn(curriculumService, 'softDelete');
    expect((await request(app).delete('/api/v1/curricula/curriculum-1')).status).toBe(403);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('updateCurriculumSchema', () => {
  it('leaves topics undefined when an edit omits them, so existing topics are not wiped', () => {
    const parsed = updateCurriculumSchema.parse({ title: 'Renamed' });
    expect(parsed).toEqual({ title: 'Renamed' });
    expect('topics' in parsed).toBe(false);
  });
});
