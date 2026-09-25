import { StudentProfileModel } from '../../modules/students/student.model';
import request from 'supertest';
import app from '../../app';
import { computeTopicProgress } from '../../modules/courses/course-progress';
import { courseService } from '../../modules/courses/course.service';
import { CourseModel } from '../../modules/courses/course.model';
import { studentService } from '../../modules/students/student.service';

jest.mock('../../middlewares/auth.middleware', () => {
  const stub = (req: never, _res: never, next: () => void) => {
    (req as { user: unknown }).user = { publicId: 'user-1', role: 'STUDENT' };
    next();
  };
  return { authMiddleware: stub, requireAuth: stub, optionalAuth: stub };
});

const NOW = new Date('2026-09-25T12:00:00Z');
const at = (iso: string) => new Date(iso);
const cls = (publicId: string, topic: string | undefined, status: string, start: string) => ({
  publicId, topicPublicId: topic, status, startUTC: at(start), endUTC: at(start),
});

const topics = [
  { publicId: 't-1', title: 'Linear equations', order: 0 },
  { publicId: 't-2', title: 'Quadratics', order: 1 },
  { publicId: 't-3', title: 'Functions', order: 2 },
];

describe('computeTopicProgress', () => {
  it('marks a topic COMPLETED only when it has classes and every counted class is COMPLETED', () => {
    const { topics: result } = computeTopicProgress(topics, [
      cls('c-1', 't-1', 'COMPLETED', '2026-09-20T10:00:00Z'),
      cls('c-2', 't-1', 'CANCELLED', '2026-09-21T10:00:00Z'), // ignored
      cls('c-3', 't-2', 'COMPLETED', '2026-09-22T10:00:00Z'),
      cls('c-4', 't-2', 'SCHEDULED', '2026-09-28T10:00:00Z'),
    ], NOW);

    expect(result.map((t) => [t.publicId, t.status])).toEqual([
      ['t-1', 'COMPLETED'],
      ['t-2', 'SCHEDULED'],
      ['t-3', 'NOT_SCHEDULED'],
    ]);
  });

  it('gives the earliest upcoming SCHEDULED/LIVE class as nextClass', () => {
    const { topics: result } = computeTopicProgress(topics.slice(0, 1), [
      cls('c-late', 't-1', 'SCHEDULED', '2026-10-05T10:00:00Z'),
      cls('c-soon', 't-1', 'SCHEDULED', '2026-09-26T10:00:00Z'),
      cls('c-past', 't-1', 'SCHEDULED', '2026-09-01T10:00:00Z'), // in the past, not "upcoming"
    ], NOW);

    expect(result[0].status).toBe('SCHEDULED');
    expect(result[0].nextClass?.publicId).toBe('c-soon');
  });

  it('treats a LIVE class as the next class', () => {
    const { topics: result } = computeTopicProgress(topics.slice(0, 1), [
      cls('c-live', 't-1', 'LIVE', '2026-09-25T11:30:00Z'),
    ], NOW);
    expect(result[0].nextClass?.publicId).toBe('c-live');
  });

  it('keeps a topic with a MISSED class incomplete, and NOT_SCHEDULED if nothing is upcoming', () => {
    const { topics: result } = computeTopicProgress(topics.slice(0, 1), [
      cls('c-1', 't-1', 'COMPLETED', '2026-09-20T10:00:00Z'),
      cls('c-2', 't-1', 'MISSED', '2026-09-21T10:00:00Z'),
    ], NOW);
    expect(result[0].status).toBe('NOT_SCHEDULED');
  });

  it('lists each topic\'s non-ignored classes in time order, and groups untagged classes separately', () => {
    const { topics: result, otherClasses } = computeTopicProgress(topics.slice(0, 1), [
      cls('c-2', 't-1', 'SCHEDULED', '2026-09-28T10:00:00Z'),
      cls('c-1', 't-1', 'COMPLETED', '2026-09-20T10:00:00Z'),
      cls('c-x', 't-1', 'RESCHEDULED', '2026-09-19T10:00:00Z'),
      cls('c-u', undefined, 'SCHEDULED', '2026-09-27T10:00:00Z'),
      cls('c-other', 't-9', 'COMPLETED', '2026-09-18T10:00:00Z'), // tagged to a topic not selected
    ], NOW);

    expect(result[0].classes.map((c) => c.publicId)).toEqual(['c-1', 'c-2']);
    expect(otherClasses.map((c) => c.publicId)).toEqual(['c-other', 'c-u']);
  });
});

describe('courseService.getStructure (progress alias)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('404s a course that belongs to another student', async () => {
    jest.spyOn(CourseModel, 'findOne').mockReturnValue({ lean: () => Promise.resolve({ publicId: 'cr-1', studentPublicId: 'someone-else', tutorPublicId: 't', isDeleted: false }) } as never);
    jest.spyOn(StudentProfileModel, 'findOne').mockReturnValue({ lean: () => Promise.resolve({ publicId: 'student-me' }) } as never);

    await expect(courseService.getStructure('cr-1', { role: 'STUDENT', userPublicId: 'user-1' })).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('GET /courses', () => {
  afterEach(() => jest.restoreAllMocks());

  it('/mine passes a comma-separated status filter through', async () => {
    const spy = jest.spyOn(courseService, 'getForStudent').mockResolvedValue({ items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } } as never);
    await request(app).get('/api/v1/courses/mine?status=ACCEPTED,COMPLETED');
    expect(spy).toHaveBeenCalledWith('user-1', expect.objectContaining({ status: 'ACCEPTED,COMPLETED' }));
  });

  it('/:id/progress and /:id/structure return the structure for the caller', async () => {
    const spy = jest.spyOn(courseService, 'getStructure').mockResolvedValue({ topics: [] } as never);
    expect((await request(app).get('/api/v1/courses/cr-1/progress')).status).toBe(200);
    expect((await request(app).get('/api/v1/courses/cr-1/structure')).status).toBe(200);
    expect(spy).toHaveBeenCalledWith('cr-1', { role: 'STUDENT', userPublicId: 'user-1' });
  });
});

describe('_list status filter', () => {
  afterEach(() => jest.restoreAllMocks());

  it('turns a comma-separated status into $in', async () => {
    jest.spyOn(studentService, 'getByUserPublicId').mockResolvedValue({ publicId: 'student-me' } as never);
    const findSpy = jest.spyOn(CourseModel, 'find').mockReturnValue({
      sort: () => ({ skip: () => ({ limit: () => ({ lean: () => Promise.resolve([]) }) }) }),
    } as never);
    jest.spyOn(CourseModel, 'countDocuments').mockResolvedValue(0 as never);

    await courseService.getForStudent('user-1', { status: 'ACCEPTED,COMPLETED' });

    expect(findSpy).toHaveBeenCalledWith(expect.objectContaining({ status: { $in: ['ACCEPTED', 'COMPLETED'] } }));
  });
});
