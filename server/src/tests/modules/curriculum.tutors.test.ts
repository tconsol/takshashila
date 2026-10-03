import request from 'supertest';
import app from '../../app';
import { tutorService } from '../../modules/tutors/tutor.service';
import { TutorProfileModel } from '../../modules/tutors/tutor.model';
import { userRepository } from '../../modules/users/user.repository';
import { curriculumService } from '../../modules/curricula/curriculum.service';
import { updateTutorProfileSchema } from '../../modules/tutors/tutor.validators';
import { createCurriculumSchema } from '../../modules/curricula/curriculum.validators';

jest.mock('../../middlewares/auth.middleware', () => {
  const stub = (req: never, _res: never, next: () => void) => {
    (req as { user: unknown }).user = { publicId: 'user-1', role: 'STUDENT' };
    next();
  };
  return { authMiddleware: stub, requireAuth: stub, optionalAuth: stub };
});

const findChain = (v: unknown) => ({ sort: () => ({ limit: () => ({ lean: () => Promise.resolve(v) }) }) });

describe('tutorService.findForCurriculum', () => {
  afterEach(() => jest.restoreAllMocks());

  it('queries ACTIVE tutors for the subject (case-insensitive) who teach the grade or have no grades set', async () => {
    const findSpy = jest.spyOn(TutorProfileModel, 'find').mockReturnValue(findChain([]) as never);
    jest.spyOn(userRepository, 'findManyByPublicIds').mockResolvedValue([]);

    await tutorService.findForCurriculum({ subject: 'mathematics', grade: 'Grade 8' });

    const filter = (findSpy.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(filter.isDeleted).toBe(false);
    expect(filter.status).toBe('ACTIVE');
    const subjects = filter.subjects as RegExp;
    expect(subjects.test('Mathematics')).toBe(true);
    expect(subjects.test('Applied Mathematics')).toBe(false);
    expect(filter.$or).toEqual([
      { gradesTaught: 'Grade 8' },
      { gradesTaught: { $exists: false } },
      { gradesTaught: { $size: 0 } },
    ]);
  });

  it('matches a High School curriculum to tutors teaching any of Grades 9-12, or no grades', async () => {
    const findSpy = jest.spyOn(TutorProfileModel, 'find').mockReturnValue(findChain([]) as never);
    jest.spyOn(userRepository, 'findManyByPublicIds').mockResolvedValue([]);

    await tutorService.findForCurriculum({ subject: 'Mathematics', grade: 'High School' });

    const filter = (findSpy.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(filter.$or).toEqual([
      { gradesTaught: { $in: ['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'] } },
      { gradesTaught: { $exists: false } },
      { gradesTaught: { $size: 0 } },
    ]);
    // Grade 5 is not among the accepted values; Grade 10 is.
    const accepted = ((filter.$or as { gradesTaught: { $in?: string[] } }[])[0].gradesTaught.$in) as string[];
    expect(accepted).toContain('Grade 10');
    expect(accepted).not.toContain('Grade 5');
  });

  it('matches Physics/Chemistry/Biology tutors to a Science curriculum', async () => {
    const findSpy = jest.spyOn(TutorProfileModel, 'find').mockReturnValue(findChain([]) as never);
    jest.spyOn(userRepository, 'findManyByPublicIds').mockResolvedValue([]);

    await tutorService.findForCurriculum({ subject: 'Science', grade: 'Grade 8' });

    const subjects = (findSpy.mock.calls[0] as unknown as [Record<string, unknown>])[0].subjects as RegExp;
    for (const s of ['Science', 'Physics', 'chemistry', 'Biology']) expect(subjects.test(s)).toBe(true);
    expect(subjects.test('Mathematics')).toBe(false);
    expect(subjects.test('Applied Physics')).toBe(false);
  });

  it('escapes regex characters in the subject', async () => {
    const findSpy = jest.spyOn(TutorProfileModel, 'find').mockReturnValue(findChain([]) as never);
    jest.spyOn(userRepository, 'findManyByPublicIds').mockResolvedValue([]);

    await tutorService.findForCurriculum({ subject: 'C++', grade: 'Grade 8' });

    const subjects = (findSpy.mock.calls[0] as unknown as [Record<string, unknown>])[0].subjects as RegExp;
    expect(subjects.test('C++')).toBe(true);
    expect(subjects.test('CCC')).toBe(false);
  });

  it('returns only public card fields with the tutor name, dropping tutors whose user is gone', async () => {
    jest.spyOn(TutorProfileModel, 'find').mockReturnValue(
      findChain([
        { publicId: 't-1', userPublicId: 'u-1', rating: 4.5, ratingCount: 10, hourlyRateCents: 2500, bio: 'Hi', isVerified: true, totalEarningsCents: 999 },
        { publicId: 't-2', userPublicId: 'u-gone', rating: 5, ratingCount: 1, hourlyRateCents: 100, isVerified: false },
      ]) as never,
    );
    jest.spyOn(userRepository, 'findManyByPublicIds').mockResolvedValue([
      { publicId: 'u-1', firstName: 'Ada', lastName: 'Lovelace' },
    ] as never);

    const result = await tutorService.findForCurriculum({ subject: 'Mathematics', grade: 'Grade 8' });

    expect(result).toEqual([
      { publicId: 't-1', displayName: 'Ada Lovelace', rating: 4.5, ratingCount: 10, hourlyRateCents: 2500, bio: 'Hi', isVerified: true },
    ]);
  });
});

describe('GET /curricula/:curriculumPublicId/tutors', () => {
  afterEach(() => jest.restoreAllMocks());

  it('lists tutors for a published curriculum using its subject and grade', async () => {
    jest.spyOn(curriculumService, 'getByPublicId').mockResolvedValue({ publicId: 'c-1', subject: 'Mathematics', grade: 'Grade 8', isPublished: true } as never);
    const spy = jest.spyOn(tutorService, 'findForCurriculum').mockResolvedValue([{ publicId: 't-1' }] as never);

    const res = await request(app).get('/api/v1/curricula/c-1/tutors');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ publicId: 't-1' }]);
    expect(spy).toHaveBeenCalledWith({ subject: 'Mathematics', grade: 'Grade 8' });
  });

  it('404s an unpublished curriculum for a student', async () => {
    jest.spyOn(curriculumService, 'getByPublicId').mockResolvedValue({ publicId: 'c-1', isPublished: false } as never);
    const spy = jest.spyOn(tutorService, 'findForCurriculum');

    expect((await request(app).get('/api/v1/curricula/c-1/tutors')).status).toBe(404);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('validators', () => {
  it('tutor gradesTaught accepts known grades only', () => {
    expect(updateTutorProfileSchema.safeParse({ gradesTaught: ['Grade 1', 'Grade 12'] }).success).toBe(true);
    expect(updateTutorProfileSchema.safeParse({ gradesTaught: ['Grade 13'] }).success).toBe(false);
  });

  it('curriculum subject is normalised the same way tutor subjects are', () => {
    const parsed = createCurriculumSchema.parse({
      stateCode: 'CO', grade: 'Grade 8', subject: '  maths ', title: 'Algebra', chapters: [],
    });
    expect(parsed.subject).toBe('Mathematics');
  });
});
