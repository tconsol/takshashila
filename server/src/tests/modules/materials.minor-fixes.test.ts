// Regression tests for the minor findings of the curriculum-materials review.
import request from 'supertest';
import app from '../../app';
import { worksheetService } from '../../modules/worksheets/worksheet.service';
import { WorksheetModel, WorksheetSubmissionModel } from '../../modules/worksheets/worksheet.model';
import { AssignmentModel, SubmissionModel } from '../../modules/assignments/assignment.model';
import { assignmentService } from '../../modules/assignments/assignment.service';
import { CourseModel } from '../../modules/courses/course.model';
import { TutorProfileModel } from '../../modules/tutors/tutor.model';
import { ParentProfileModel } from '../../modules/parents/parent.model';
import { StudentProfileModel } from '../../modules/students/student.model';
import { ScheduledClassModel } from '../../modules/schedules/schedule.model';
import { courseService } from '../../modules/courses/course.service';
import { canViewMaterial, findGraderTutor } from '../../modules/courses/material-access';
import * as access from '../../modules/courses/material-access';
import { softDeleteCurriculumMaterial } from '../../modules/curricula/curriculum-materials';
import { settingsService } from '../../modules/settings/settings.service';
import { domainEvents } from '../../events/event-emitter';

jest.mock('../../middlewares/auth.middleware', () => {
  const stub = (req: never, _res: never, next: () => void) => {
    (req as { user: unknown }).user = { publicId: 'admin-u', role: 'ADMIN' };
    next();
  };
  return { authMiddleware: stub, requireAuth: stub, optionalAuth: stub };
});

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });
const adminItem = { publicId: 'a-1', status: 'PUBLISHED', maxScore: 10, curriculumPublicId: 'cur-1', topicPublicIds: ['t-1'], authorRole: 'ADMIN' };

describe('minor review fixes', () => {
  afterEach(() => jest.restoreAllMocks());

  it('M1: unsubmitted count uses the same scope as the Homework list (no admin items)', async () => {
    jest.spyOn(CourseModel, 'find').mockReturnValue(lean([]) as never);
    jest.spyOn(StudentProfileModel, 'find').mockReturnValue(lean([]) as never);
    jest.spyOn(ScheduledClassModel, 'distinct').mockResolvedValue([] as never);
    const count = jest.spyOn(WorksheetModel, 'countDocuments').mockResolvedValue(0 as never);
    jest.spyOn(WorksheetSubmissionModel, 'countDocuments').mockResolvedValue(0 as never);
    await worksheetService.countUnsubmittedForStudent('sp-1');
    expect(count).toHaveBeenCalledWith(expect.objectContaining({
      authorRole: { $ne: 'ADMIN' },
      $and: [{ $or: [
        { curriculumPublicId: { $exists: false }, assignedToStudentPublicIds: 'sp-1' },
        { curriculumPublicId: { $exists: false }, tutorPublicId: { $in: [] } },
      ] }],
    }));
  });

  it('M2: grader is the most recently ACCEPTED course, not the most recently touched one', async () => {
    const sort = jest.fn(() => lean({ tutorPublicId: 'tp-B' }));
    jest.spyOn(CourseModel, 'findOne').mockReturnValue({ sort } as never);
    await findGraderTutor('sp-1', adminItem as never);
    expect(sort).toHaveBeenCalledWith({ acceptedAt: -1, createdAt: -1 });
  });

  it('M2: a resubmission keeps the original grader', async () => {
    jest.spyOn(AssignmentModel, 'findOne').mockResolvedValue(adminItem as never);
    jest.spyOn(SubmissionModel, 'findOne').mockResolvedValue({ graderTutorPublicId: 'tp-A' } as never);
    const grader = jest.spyOn(access, 'findGraderTutor').mockResolvedValue('tp-B');
    const upd = jest.spyOn(SubmissionModel, 'findOneAndUpdate').mockReturnValue(lean({}) as never);
    await assignmentService.submit('a-1', 'sp-1', { content: 'again' });
    expect(grader).not.toHaveBeenCalled();
    expect(((upd.mock.calls[0] as unknown as [unknown, { $set: Record<string, unknown> }])[1]).$set.graderTutorPublicId).toBeUndefined();
  });

  it('M2: the course submissions panel only shows submissions this tutor grades', async () => {
    jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'tp-A' }) as never);
    jest.spyOn(CourseModel, 'findOne').mockReturnValue(lean({
      publicId: 'c-1', tutorPublicId: 'tp-A', studentPublicId: 'sp-1', status: 'ACCEPTED', curriculumPublicId: 'cur-1', topicPublicIds: ['t-1'],
    }) as never);
    jest.spyOn(AssignmentModel, 'exists').mockResolvedValue({ _id: 'x' } as never);
    const find = jest.spyOn(SubmissionModel, 'find').mockReturnValue({ sort: () => lean([]) } as never);
    await courseService.getMaterialSubmissions('c-1', 'tu-A', 'assignment', 'a-1');
    expect(find).toHaveBeenCalledWith({ assignmentPublicId: 'a-1', studentPublicId: 'sp-1', isDeleted: false, graderTutorPublicId: 'tp-A' });
  });

  it('M3: admin create endpoints validate their body (422, not 500)', async () => {
    jest.spyOn(settingsService, 'get').mockResolvedValue({ maintenanceMode: false } as never);
    expect((await request(app).post('/api/v1/curricula/cur-1/resources').send({ title: 'x', topicPublicIds: ['t-1'] })).status).toBe(422);
    expect((await request(app).post('/api/v1/curricula/cur-1/assignments').send({ title: 'x', topicPublicIds: ['t-1'], maxScore: -3, description: 'long enough' })).status).toBe(422);
    expect((await request(app).post('/api/v1/curricula/cur-1/worksheets').send({ title: 'x', type: 'BOGUS', topicPublicIds: ['t-1'] })).status).toBe(422);
  });

  it('M4: prototype keys are not valid material kinds', async () => {
    await expect(softDeleteCurriculumMaterial('toString', 'cur-1', 'x')).rejects.toMatchObject({ statusCode: 422 });
  });

  it('M5: admin assignment submissions tell the grading tutor', async () => {
    jest.spyOn(AssignmentModel, 'findOne').mockResolvedValue(adminItem as never);
    jest.spyOn(SubmissionModel, 'findOne').mockResolvedValue(null as never);
    jest.spyOn(access, 'findGraderTutor').mockResolvedValue('tp-B');
    jest.spyOn(SubmissionModel, 'create').mockResolvedValue({ toObject: () => ({}) } as never);
    const emit = jest.spyOn(domainEvents, 'emit').mockReturnValue(true as never);
    await assignmentService.submit('a-1', 'sp-1', { content: 'answer' });
    expect(emit).toHaveBeenCalledWith('ASSIGNMENT_SUBMITTED', expect.objectContaining({ graderTutorPublicId: 'tp-B' }));
  });

  it('M9: deleted parent profiles are ignored', async () => {
    const findOne = jest.spyOn(ParentProfileModel, 'findOne').mockReturnValue(lean(null) as never);
    await canViewMaterial({ role: 'PARENT', userPublicId: 'pu-1' }, adminItem as never);
    expect(findOne).toHaveBeenCalledWith({ userPublicId: 'pu-1', isDeleted: false });
  });
});
