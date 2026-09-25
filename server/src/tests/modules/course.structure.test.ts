// server/src/tests/modules/course.structure.test.ts
import { courseService } from '../../modules/courses/course.service';
import { CourseModel } from '../../modules/courses/course.model';
import { CurriculumModel } from '../../modules/curricula/curriculum.model';
import { ScheduledClassModel } from '../../modules/schedules/schedule.model';
import { ResourceModel } from '../../modules/resources/resource.model';
import { AssignmentModel } from '../../modules/assignments/assignment.model';
import { WorksheetModel } from '../../modules/worksheets/worksheet.model';
import { TutorProfileModel } from '../../modules/tutors/tutor.model';
import { StudentProfileModel } from '../../modules/students/student.model';
import { ParentProfileModel } from '../../modules/parents/parent.model';
import { UserModel } from '../../modules/users/user.model';
import { getCurriculumStructure } from '../../modules/courses/course-structure';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });
const course = {
  publicId: 'c-1', studentPublicId: 'sp-1', tutorPublicId: 'tp-A', curriculumPublicId: 'cur-1',
  topicPublicIds: ['t-1'], status: 'ACCEPTED', classesRequired: 2, classesCompletedCount: 1, isDeleted: false,
};
const curriculum = {
  publicId: 'cur-1', title: 'Algebra I', subject: 'Mathematics', grade: 'Grade 8', district: 'Wake', state: 'NC',
  topics: [{ publicId: 't-1', title: 'Linear', order: 0 }, { publicId: 't-2', title: 'Quadratic', order: 1 }],
};

function mockWorld() {
  jest.spyOn(CourseModel, 'findOne').mockReturnValue(lean(course) as never);
  jest.spyOn(CurriculumModel, 'findOne').mockReturnValue(lean(curriculum) as never);
  jest.spyOn(CurriculumModel, 'find').mockReturnValue(lean([curriculum]) as never); // enrichCourses titles
  jest.spyOn(ScheduledClassModel, 'find').mockReturnValue(lean([
    { publicId: 'k-1', status: 'COMPLETED', startUTC: new Date('2026-09-01'), endUTC: new Date('2026-09-01'), topicPublicId: 't-1' },
  ]) as never);
  const resFind = jest.spyOn(ResourceModel, 'find').mockReturnValue(lean([
    { publicId: 'r-1', title: 'Notes', topicPublicIds: ['t-1'], authorRole: 'ADMIN', authorUserPublicId: 'admin-u' },
    { publicId: 'r-2', title: 'Only t-2', topicPublicIds: ['t-2'], authorRole: 'ADMIN', authorUserPublicId: 'admin-u' },
  ]) as never);
  jest.spyOn(AssignmentModel, 'find').mockReturnValue(lean([]) as never);
  jest.spyOn(WorksheetModel, 'find').mockReturnValue(lean([
    { publicId: 'w-1', title: 'Quiz', topicPublicIds: ['t-1'], authorRole: 'TUTOR', tutorPublicId: 'tp-A' },
  ]) as never);
  jest.spyOn(TutorProfileModel, 'find').mockReturnValue(lean([{ publicId: 'tp-A', userPublicId: 'tu-A' }]) as never);
  jest.spyOn(StudentProfileModel, 'find').mockReturnValue(lean([{ publicId: 'sp-1', userPublicId: 'su-1' }]) as never);
  jest.spyOn(UserModel, 'find').mockReturnValue(lean([
    { publicId: 'tu-A', firstName: 'Tara', lastName: 'Tutor' },
    { publicId: 'su-1', firstName: 'Sam', lastName: 'Student' },
    { publicId: 'admin-u', firstName: 'Ada', lastName: 'Admin' },
  ]) as never);
  return { resFind };
}

describe('courseService.getStructure', () => {
  afterEach(() => jest.restoreAllMocks());

  it('student sees status and the materials of their course topics only', async () => {
    const { resFind } = mockWorld();
    jest.spyOn(StudentProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'sp-1' }) as never);

    const s = await courseService.getStructure('c-1', { role: 'STUDENT', userPublicId: 'su-1' });

    expect(s.viewerRole).toBe('STUDENT');
    expect(s.topics.map((t) => t.publicId)).toEqual(['t-1']);
    expect(s.topics[0].status).toBe('COMPLETED');
    expect(s.topics[0].materials).toEqual([
      { kind: 'resource', publicId: 'r-1', title: 'Notes', authorRole: 'ADMIN', authorName: 'Ada Admin' },
      { kind: 'worksheet', publicId: 'w-1', title: 'Quiz', authorRole: 'TUTOR', authorName: 'Tara Tutor' },
    ]);
    expect(resFind).toHaveBeenCalledWith(expect.objectContaining({
      $or: [{ authorRole: 'ADMIN' }, { tutorPublicId: 'tp-A' }],
    }), expect.anything());
  });

  it('tutor of the course sees the tree without status', async () => {
    mockWorld();
    jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'tp-A' }) as never);
    const s = await courseService.getStructure('c-1', { role: 'TUTOR', userPublicId: 'tu-A' });
    expect(s.viewerRole).toBe('TUTOR');
    expect(s.topics[0]).not.toHaveProperty('status');
    expect(s.topics[0]).not.toHaveProperty('nextClass');
  });

  it('parent of the student sees status; other parents get 404', async () => {
    mockWorld();
    jest.spyOn(ParentProfileModel, 'findOne').mockReturnValue(lean({ childStudentPublicIds: ['sp-1'] }) as never);
    expect((await courseService.getStructure('c-1', { role: 'PARENT', userPublicId: 'pu-1' })).topics[0].status).toBe('COMPLETED');

    jest.spyOn(ParentProfileModel, 'findOne').mockReturnValue(lean({ childStudentPublicIds: ['sp-9'] }) as never);
    await expect(courseService.getStructure('c-1', { role: 'PARENT', userPublicId: 'pu-2' })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('another student or tutor gets 404', async () => {
    mockWorld();
    jest.spyOn(StudentProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'sp-9' }) as never);
    await expect(courseService.getStructure('c-1', { role: 'STUDENT', userPublicId: 'x' })).rejects.toMatchObject({ statusCode: 404 });
    jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'tp-Z' }) as never);
    await expect(courseService.getStructure('c-1', { role: 'TUTOR', userPublicId: 'y' })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('admin sees it without status', async () => {
    mockWorld();
    const s = await courseService.getStructure('c-1', { role: 'ADMIN', userPublicId: 'a' });
    expect(s.viewerRole).toBe('ADMIN');
    expect(s.topics[0]).not.toHaveProperty('status');
  });
});

describe('getCurriculumStructure', () => {
  afterEach(() => jest.restoreAllMocks());

  it('lists every topic with all materials from any author', async () => {
    mockWorld();
    const s = await getCurriculumStructure('cur-1');
    expect(s.topics.map((t) => [t.publicId, t.materials.map((m) => m.publicId)])).toEqual([
      ['t-1', ['r-1', 'w-1']],
      ['t-2', ['r-2']],
    ]);
  });
});

describe('courseService.getForParent', () => {
  afterEach(() => jest.restoreAllMocks());

  it('returns active courses of the parent\'s children', async () => {
    jest.spyOn(ParentProfileModel, 'findOne').mockReturnValue(lean({ childStudentPublicIds: ['sp-1'] }) as never);
    const find = jest.spyOn(CourseModel, 'find').mockReturnValue({ sort: () => lean([]) } as never);
    await courseService.getForParent('pu-1');
    expect(find).toHaveBeenCalledWith({ studentPublicId: { $in: ['sp-1'] }, status: { $in: ['ACCEPTED', 'COMPLETED'] }, isDeleted: false });
  });
});
