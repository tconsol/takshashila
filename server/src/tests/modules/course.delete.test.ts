import request from 'supertest';
import app from '../../app';
import { courseService } from '../../modules/courses/course.service';
import { CourseModel } from '../../modules/courses/course.model';
import { CourseRequestModel } from '../../modules/course-requests/course-request.model';
import { updateCourseSchema } from '../../modules/courses/course.validators';

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

describe('CourseService.softDelete', () => {
  afterEach(() => jest.restoreAllMocks());

  it('refuses while a PENDING or ACCEPTED request exists, and never touches the course', async () => {
    jest.spyOn(CourseModel, 'findOne').mockReturnValue(lean({ publicId: 'course-1' }) as never);
    const countSpy = jest.spyOn(CourseRequestModel, 'countDocuments').mockResolvedValue(2 as never);
    const updateSpy = jest.spyOn(CourseModel, 'updateOne');

    await expect(courseService.softDelete('course-1')).rejects.toMatchObject({ statusCode: 409 });

    expect(countSpy).toHaveBeenCalledWith({
      coursePublicId: 'course-1',
      status: { $in: ['PENDING', 'ACCEPTED'] },
      isDeleted: false,
    });
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('soft-deletes and unpublishes when every request is finished', async () => {
    jest.spyOn(CourseModel, 'findOne').mockReturnValue(lean({ publicId: 'course-1' }) as never);
    jest.spyOn(CourseRequestModel, 'countDocuments').mockResolvedValue(0 as never);
    const updateSpy = jest.spyOn(CourseModel, 'updateOne').mockResolvedValue({} as never);

    await courseService.softDelete('course-1');

    expect(updateSpy).toHaveBeenCalledWith(
      { publicId: 'course-1', isDeleted: false },
      { $set: { isDeleted: true, isPublished: false } },
    );
  });

  it('404s a missing or already-deleted course', async () => {
    jest.spyOn(CourseModel, 'findOne').mockReturnValue(lean(null) as never);
    await expect(courseService.softDelete('nope')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('DELETE /courses/:coursePublicId', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    mockRole = 'ADMIN';
  });

  it('lets an ADMIN delete', async () => {
    const spy = jest.spyOn(courseService, 'softDelete').mockResolvedValue(undefined);
    const res = await request(app).delete('/api/v1/courses/course-1');
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledWith('course-1');
  });

  it('lets a SUPER_ADMIN delete', async () => {
    mockRole = 'SUPER_ADMIN';
    jest.spyOn(courseService, 'softDelete').mockResolvedValue(undefined);
    expect((await request(app).delete('/api/v1/courses/course-1')).status).toBe(200);
  });

  it('403s a STUDENT', async () => {
    mockRole = 'STUDENT';
    const spy = jest.spyOn(courseService, 'softDelete');
    expect((await request(app).delete('/api/v1/courses/course-1')).status).toBe(403);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('updateCourseSchema', () => {
  it('leaves topics undefined when an edit omits them, so existing topics are not wiped', () => {
    const parsed = updateCourseSchema.parse({ title: 'Renamed' });
    expect(parsed).toEqual({ title: 'Renamed' });
    expect('topics' in parsed).toBe(false);
  });
});
