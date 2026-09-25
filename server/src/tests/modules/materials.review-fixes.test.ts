// Regression tests for the whole-branch review of the curriculum-materials work.
import { resourceService } from '../../modules/resources/resource.service';
import { ResourceModel } from '../../modules/resources/resource.model';
import { courseService } from '../../modules/courses/course.service';
import { CourseModel } from '../../modules/courses/course.model';
import { StudentProfileModel } from '../../modules/students/student.model';
import { TutorProfileModel } from '../../modules/tutors/tutor.model';
import { canViewMaterial, studentMaterialScope } from '../../modules/courses/material-access';
import { worksheetService } from '../../modules/worksheets/worksheet.service';
import { WorksheetModel, WorksheetSubmissionModel } from '../../modules/worksheets/worksheet.model';
import { assignmentService } from '../../modules/assignments/assignment.service';
import { AssignmentModel, SubmissionModel } from '../../modules/assignments/assignment.model';
import { ScheduledClassModel } from '../../modules/schedules/schedule.model';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });
const sortLean = (v: unknown) => ({ sort: () => lean(v) });

describe('review fixes', () => {
  afterEach(() => jest.restoreAllMocks());

  it('C1: resource PATCH only changes title and description', async () => {
    const upd = jest.spyOn(ResourceModel, 'findOneAndUpdate').mockReturnValue(lean({ publicId: 'r-1' }) as never);
    await resourceService.update('r-1', 'tp-A', {
      title: 'New', description: 'd', authorRole: 'ADMIN', curriculumPublicId: 'x', topicPublicIds: ['t'], tutorPublicId: 'tp-B',
    } as never);
    expect(upd).toHaveBeenCalledWith(
      { publicId: 'r-1', tutorPublicId: 'tp-A', isDeleted: false },
      { $set: { title: 'New', description: 'd' } },
      { new: true },
    );
  });

  it('I1: a student cannot load the structure of their PENDING course', async () => {
    jest.spyOn(CourseModel, 'findOne').mockReturnValue(lean({ publicId: 'c-1', studentPublicId: 'sp-1', tutorPublicId: 'tp-A', status: 'PENDING' }) as never);
    jest.spyOn(StudentProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'sp-1' }) as never);
    await expect(courseService.getStructure('c-1', { role: 'STUDENT', userPublicId: 'su-1' })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('I2: a principal (tutor profile) opens their own curriculum item', async () => {
    jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'tp-P' }) as never);
    expect(await canViewMaterial(
      { role: 'PRINCIPAL', userPublicId: 'pu' },
      { curriculumPublicId: 'cur-1', topicPublicIds: ['t-1'], authorRole: 'TUTOR', tutorPublicId: 'tp-P' },
    )).toBe(true);
  });

  it('I3: student list scope = legacy items from their tutors or items matching an active course', async () => {
    jest.spyOn(CourseModel, 'find').mockReturnValue(lean([
      { curriculumPublicId: 'cur-1', tutorPublicId: 'tp-A', topicPublicIds: ['t-1'] },
    ]) as never);
    jest.spyOn(StudentProfileModel, 'find').mockReturnValue(lean([{ publicId: 'sp-1', tutorPublicId: 'tp-A' }]) as never);
    jest.spyOn(ScheduledClassModel, 'distinct').mockResolvedValue([] as never);
    expect(await studentMaterialScope('sp-1', 'resource')).toEqual({
      $or: [
        { curriculumPublicId: { $exists: false }, tutorPublicId: { $in: ['tp-A'] } },
        { curriculumPublicId: 'cur-1', tutorPublicId: 'tp-A', topicPublicIds: { $in: ['t-1'] }, authorRole: { $ne: 'ADMIN' } },
      ],
    });
  });

  it('I3: worksheet and resource student lists apply that scope', async () => {
    jest.spyOn(CourseModel, 'find').mockReturnValue(lean([]) as never);
    jest.spyOn(StudentProfileModel, 'find').mockReturnValue(lean([]) as never);
    jest.spyOn(ScheduledClassModel, 'distinct').mockResolvedValue([] as never);
    const wFind = jest.spyOn(WorksheetModel, 'find').mockReturnValue({ sort: () => ({ skip: () => ({ limit: () => lean([]) }) }) } as never);
    jest.spyOn(WorksheetModel, 'countDocuments').mockResolvedValue(0 as never);
    jest.spyOn(WorksheetSubmissionModel, 'find').mockReturnValue(lean([]) as never);
    await worksheetService.getForStudent('sp-1', {});
    expect((wFind.mock.calls[0] as unknown as [Record<string, unknown>])[0].$and).toEqual([{ $or: [
      { curriculumPublicId: { $exists: false }, assignedToStudentPublicIds: 'sp-1' },
      { curriculumPublicId: { $exists: false }, tutorPublicId: { $in: [] } },
    ] }]);

    const rFind = jest.spyOn(ResourceModel, 'find').mockReturnValue({ sort: () => ({ skip: () => ({ limit: () => lean([]) }) }) } as never);
    jest.spyOn(ResourceModel, 'countDocuments').mockResolvedValue(0 as never);
    await resourceService.getForStudent('sp-1', 'tp-A', {});
    expect((rFind.mock.calls[0] as unknown as [Record<string, unknown>])[0].$and).toEqual([{ $or: [
      { curriculumPublicId: { $exists: false }, tutorPublicId: { $in: [] } },
    ] }]);
  });

  it('I4: assignment submissions — owner only for tutor items, own graded students for admin items', async () => {
    jest.spyOn(AssignmentModel, 'findOne').mockReturnValue(lean({ publicId: 'a-1', authorRole: 'TUTOR', tutorPublicId: 'tp-A' }) as never);
    await expect(assignmentService.getSubmissionsForAssignment('a-1', 'tp-B')).rejects.toMatchObject({ statusCode: 404 });

    jest.spyOn(AssignmentModel, 'findOne').mockReturnValue(lean({ publicId: 'a-1', authorRole: 'ADMIN' }) as never);
    const find = jest.spyOn(SubmissionModel, 'find').mockReturnValue(sortLean([]) as never);
    await assignmentService.getSubmissionsForAssignment('a-1', 'tp-B');
    expect(find).toHaveBeenCalledWith({ assignmentPublicId: 'a-1', isDeleted: false, graderTutorPublicId: 'tp-B' });
  });

  it('I5: course submissions need an active course and a material that belongs to it', async () => {
    jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'tp-A' }) as never);
    jest.spyOn(CourseModel, 'findOne').mockReturnValue(lean({
      publicId: 'c-1', tutorPublicId: 'tp-A', studentPublicId: 'sp-1', status: 'REJECTED', curriculumPublicId: 'cur-1', topicPublicIds: ['t-1'],
    }) as never);
    await expect(courseService.getMaterialSubmissions('c-1', 'tu-A', 'assignment', 'a-B')).rejects.toMatchObject({ statusCode: 404 });

    jest.spyOn(CourseModel, 'findOne').mockReturnValue(lean({
      publicId: 'c-1', tutorPublicId: 'tp-A', studentPublicId: 'sp-1', status: 'ACCEPTED', curriculumPublicId: 'cur-1', topicPublicIds: ['t-1'],
    }) as never);
    const exists = jest.spyOn(AssignmentModel, 'exists').mockResolvedValue(null as never);
    await expect(courseService.getMaterialSubmissions('c-1', 'tu-A', 'assignment', 'a-B')).rejects.toMatchObject({ statusCode: 404 });
    expect(exists).toHaveBeenCalledWith(expect.objectContaining({ publicId: 'a-B', authorRole: 'ADMIN', curriculumPublicId: 'cur-1' }));
  });

  it('I6: tutor worksheet results work for admin worksheets, scoped to their graded students', async () => {
    jest.spyOn(WorksheetModel, 'findOne').mockReturnValue(lean({ publicId: 'w-1', authorRole: 'ADMIN' }) as never);
    const find = jest.spyOn(WorksheetSubmissionModel, 'find').mockReturnValue(sortLean([]) as never);
    await worksheetService.getSubmissionsForWorksheet('w-1', 'tp-B');
    expect(find).toHaveBeenCalledWith({ worksheetPublicId: 'w-1', isDeleted: false, graderTutorPublicId: 'tp-B' });

    jest.spyOn(WorksheetModel, 'findOne').mockReturnValue(lean({ publicId: 'w-2', authorRole: 'TUTOR', tutorPublicId: 'tp-A' }) as never);
    await expect(worksheetService.getSubmissionsForWorksheet('w-2', 'tp-B')).rejects.toMatchObject({ statusCode: 404 });
  });
});
