// server/src/tests/modules/materials.grading.test.ts
import { assignmentService } from '../../modules/assignments/assignment.service';
import { worksheetService } from '../../modules/worksheets/worksheet.service';
import { courseService } from '../../modules/courses/course.service';
import { AssignmentModel, SubmissionModel } from '../../modules/assignments/assignment.model';
import { WorksheetModel, WorksheetSubmissionModel } from '../../modules/worksheets/worksheet.model';
import { CourseModel } from '../../modules/courses/course.model';
import { TutorProfileModel } from '../../modules/tutors/tutor.model';
import * as access from '../../modules/courses/material-access';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });
const adminAssignment = {
  publicId: 'a-1', status: 'PUBLISHED', maxScore: 10, curriculumPublicId: 'cur-1', topicPublicIds: ['t-1'], authorRole: 'ADMIN',
};

describe('admin-item submissions', () => {
  afterEach(() => jest.restoreAllMocks());

  it('stamps the student\'s course tutor on an admin assignment submission', async () => {
    jest.spyOn(AssignmentModel, 'findOne').mockResolvedValue(adminAssignment as never);
    jest.spyOn(SubmissionModel, 'findOne').mockResolvedValue(null as never);
    jest.spyOn(access, 'findGraderTutor').mockResolvedValue('tp-B');
    const create = jest.spyOn(SubmissionModel, 'create').mockResolvedValue({ toObject: () => ({}) } as never);
    await assignmentService.submit('a-1', 'sp-1', { content: 'answer' });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ graderTutorPublicId: 'tp-B' }));
  });

  it('does not stamp tutor-authored assignments', async () => {
    jest.spyOn(AssignmentModel, 'findOne').mockResolvedValue({ ...adminAssignment, authorRole: 'TUTOR', tutorPublicId: 'tp-A' } as never);
    jest.spyOn(SubmissionModel, 'findOne').mockResolvedValue(null as never);
    const grader = jest.spyOn(access, 'findGraderTutor');
    const create = jest.spyOn(SubmissionModel, 'create').mockResolvedValue({ toObject: () => ({}) } as never);
    await assignmentService.submit('a-1', 'sp-1', { content: 'answer' });
    expect(grader).not.toHaveBeenCalled();
    expect((create.mock.calls[0] as unknown as [Record<string, unknown>])[0].graderTutorPublicId).toBeUndefined();
  });

  it('lets the stamped tutor grade and 403s any other tutor', async () => {
    jest.spyOn(SubmissionModel, 'findOne').mockResolvedValue({ publicId: 's-1', assignmentPublicId: 'a-1', graderTutorPublicId: 'tp-B' } as never);
    jest.spyOn(AssignmentModel, 'findOne').mockResolvedValue(adminAssignment as never);
    jest.spyOn(SubmissionModel, 'findOneAndUpdate').mockReturnValue(lean({ status: 'GRADED' }) as never);
    await expect(assignmentService.gradeSubmission('s-1', 'tp-B', { score: 8 })).resolves.toMatchObject({ status: 'GRADED' });
    await expect(assignmentService.gradeSubmission('s-1', 'tp-C', { score: 8 })).rejects.toMatchObject({ statusCode: 403 });
  });

  it('stamps the grader on admin worksheet submissions', async () => {
    jest.spyOn(WorksheetModel, 'findOne').mockReturnValue(lean({
      publicId: 'w-1', status: 'PUBLISHED', authorRole: 'ADMIN', curriculumPublicId: 'cur-1', topicPublicIds: ['t-1'],
      questions: [{ correctIndex: 1 }],
    }) as never);
    jest.spyOn(WorksheetSubmissionModel, 'findOne').mockReturnValue(lean(null) as never);
    jest.spyOn(access, 'findGraderTutor').mockResolvedValue('tp-B');
    const create = jest.spyOn(WorksheetSubmissionModel, 'create').mockResolvedValue({ toObject: () => ({}) } as never);
    await worksheetService.submitAnswers('w-1', 'sp-1', { answers: [1] });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ graderTutorPublicId: 'tp-B', score: 100 }));
  });

  it('lists a course\'s submissions for one item to that course\'s tutor only', async () => {
    jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'tp-B' }) as never);
    jest.spyOn(CourseModel, 'findOne').mockReturnValue(lean({
      publicId: 'c-1', tutorPublicId: 'tp-B', studentPublicId: 'sp-1', status: 'ACCEPTED', curriculumPublicId: 'cur-1', topicPublicIds: ['t-1'],
    }) as never);
    jest.spyOn(AssignmentModel, 'exists').mockResolvedValue({ _id: 'x' } as never);
    const find = jest.spyOn(SubmissionModel, 'find').mockReturnValue({ sort: () => lean([]) } as never);
    await courseService.getMaterialSubmissions('c-1', 'tu-B', 'assignment', 'a-1');
    expect(find).toHaveBeenCalledWith({ assignmentPublicId: 'a-1', studentPublicId: 'sp-1', isDeleted: false });

    jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'tp-Z' }) as never);
    await expect(courseService.getMaterialSubmissions('c-1', 'tu-Z', 'assignment', 'a-1')).rejects.toMatchObject({ statusCode: 404 });
  });
});
