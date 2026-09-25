// server/src/tests/modules/materials.access.test.ts
import { canViewMaterial, materialFilterForCourse, findGraderTutor } from '../../modules/courses/material-access';
import { CourseModel } from '../../modules/courses/course.model';
import { TutorProfileModel } from '../../modules/tutors/tutor.model';
import { StudentProfileModel } from '../../modules/students/student.model';
import { ParentProfileModel } from '../../modules/parents/parent.model';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });
const adminItem = { curriculumPublicId: 'cur-1', topicPublicIds: ['t-1'], authorRole: 'ADMIN' as const };
const tutorItem = { curriculumPublicId: 'cur-1', topicPublicIds: ['t-1'], authorRole: 'TUTOR' as const, tutorPublicId: 'tp-A' };

describe('canViewMaterial', () => {
  afterEach(() => jest.restoreAllMocks());

  it('legacy items (no curriculum) are not gated', async () => {
    expect(await canViewMaterial({ role: 'STUDENT', userPublicId: 'u' }, { tutorPublicId: 'tp-A' })).toBe(true);
  });

  it('admins see everything', async () => {
    expect(await canViewMaterial({ role: 'ADMIN', userPublicId: 'u' }, tutorItem)).toBe(true);
    expect(await canViewMaterial({ role: 'SUPER_ADMIN', userPublicId: 'u' }, adminItem)).toBe(true);
  });

  it('a tutor always sees their own item, even without a course on that curriculum', async () => {
    jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'tp-A' }) as never);
    const exists = jest.spyOn(CourseModel, 'exists').mockResolvedValue(null as never);
    expect(await canViewMaterial({ role: 'TUTOR', userPublicId: 'tu-A' }, tutorItem)).toBe(true);
    expect(exists).not.toHaveBeenCalled();
  });

  it('another tutor cannot see a tutor item', async () => {
    jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'tp-B' }) as never);
    expect(await canViewMaterial({ role: 'TUTOR', userPublicId: 'tu-B' }, tutorItem)).toBe(false);
  });

  it('a tutor sees an admin item only with an active course on that curriculum and topic', async () => {
    jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'tp-B' }) as never);
    const exists = jest.spyOn(CourseModel, 'exists').mockResolvedValue({ _id: 'x' } as never);
    expect(await canViewMaterial({ role: 'TUTOR', userPublicId: 'tu-B' }, adminItem)).toBe(true);
    expect(exists).toHaveBeenCalledWith({
      tutorPublicId: 'tp-B', curriculumPublicId: 'cur-1', topicPublicIds: { $in: ['t-1'] },
      status: { $in: ['ACCEPTED', 'COMPLETED'] }, isDeleted: false,
    });
  });

  it('a student needs an ACCEPTED/COMPLETED course with the item tutor for tutor items', async () => {
    jest.spyOn(StudentProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'sp-1' }) as never);
    const exists = jest.spyOn(CourseModel, 'exists').mockResolvedValue(null as never);
    expect(await canViewMaterial({ role: 'STUDENT', userPublicId: 'su-1' }, tutorItem)).toBe(false);
    expect(exists).toHaveBeenCalledWith(expect.objectContaining({
      studentPublicId: { $in: ['sp-1'] }, tutorPublicId: 'tp-A', status: { $in: ['ACCEPTED', 'COMPLETED'] },
    }));
  });

  it('a student with an active course sees admin items regardless of tutor', async () => {
    jest.spyOn(StudentProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'sp-1' }) as never);
    const exists = jest.spyOn(CourseModel, 'exists').mockResolvedValue({ _id: 'x' } as never);
    expect(await canViewMaterial({ role: 'STUDENT', userPublicId: 'su-1' }, adminItem)).toBe(true);
    expect((exists.mock.calls[0] as unknown as [Record<string, unknown>])[0]).not.toHaveProperty('tutorPublicId');
  });

  it('a parent is checked against their children', async () => {
    jest.spyOn(ParentProfileModel, 'findOne').mockReturnValue(lean({ childStudentPublicIds: ['sp-1', 'sp-2'] }) as never);
    const exists = jest.spyOn(CourseModel, 'exists').mockResolvedValue({ _id: 'x' } as never);
    expect(await canViewMaterial({ role: 'PARENT', userPublicId: 'pu-1' }, adminItem)).toBe(true);
    expect(exists).toHaveBeenCalledWith(expect.objectContaining({ studentPublicId: { $in: ['sp-1', 'sp-2'] } }));
  });

  it('a parent with no children, or any other role, is denied', async () => {
    jest.spyOn(ParentProfileModel, 'findOne').mockReturnValue(lean({ childStudentPublicIds: [] }) as never);
    expect(await canViewMaterial({ role: 'PARENT', userPublicId: 'pu-1' }, adminItem)).toBe(false);
    expect(await canViewMaterial({ role: 'PRINCIPAL', userPublicId: 'x' }, adminItem)).toBe(false);
  });
});

describe('materialFilterForCourse', () => {
  it('matches curriculum, course topics, and admin-or-own-tutor items', () => {
    expect(materialFilterForCourse({ curriculumPublicId: 'cur-1', topicPublicIds: ['t-1', 't-2'], tutorPublicId: 'tp-A' })).toEqual({
      curriculumPublicId: 'cur-1',
      topicPublicIds: { $in: ['t-1', 't-2'] },
      isDeleted: false,
      $or: [{ authorRole: 'ADMIN' }, { tutorPublicId: 'tp-A' }],
    });
  });
});

describe('findGraderTutor', () => {
  afterEach(() => jest.restoreAllMocks());

  it('returns the tutor of the most recently updated active course sharing a topic', async () => {
    const findOne = jest.spyOn(CourseModel, 'findOne').mockReturnValue({
      sort: () => lean({ tutorPublicId: 'tp-B' }),
    } as never);
    expect(await findGraderTutor('sp-1', adminItem)).toBe('tp-B');
    expect(findOne).toHaveBeenCalledWith(expect.objectContaining({ studentPublicId: 'sp-1', curriculumPublicId: 'cur-1' }));
  });
});
