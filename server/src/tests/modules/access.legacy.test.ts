// Access rules for non-curriculum (legacy) materials, media file links and class listings.
import request from 'supertest';
import app from '../../app';
import * as access from '../../modules/courses/material-access';
import { canViewMaterial, studentMaterialScope, canViewClass } from '../../modules/courses/material-access';
import { canReadMedia } from '../../modules/media/media-access';
import { mediaService } from '../../modules/media/media.service';
import { StudentProfileModel } from '../../modules/students/student.model';
import { TutorProfileModel } from '../../modules/tutors/tutor.model';
import { ParentProfileModel } from '../../modules/parents/parent.model';
import { ScheduledClassModel } from '../../modules/schedules/schedule.model';
import { CourseModel } from '../../modules/courses/course.model';
import { MediaFileModel } from '../../modules/media/media.model';
import { MessageModel, ConversationModel } from '../../modules/chat/chat.model';
import { ResourceModel } from '../../modules/resources/resource.model';
import { AssignmentModel, SubmissionModel } from '../../modules/assignments/assignment.model';
import { WorksheetModel } from '../../modules/worksheets/worksheet.model';

jest.mock('../../middlewares/auth.middleware', () => {
  const stub = (req: never, _res: never, next: () => void) => {
    (req as { user: unknown }).user = { publicId: 'su-1', role: 'STUDENT' };
    next();
  };
  return { authMiddleware: stub, requireAuth: stub, optionalAuth: stub };
});

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });
const student = { role: 'STUDENT', userPublicId: 'su-1' };

function studentWithTutor(tutor: string | undefined, classTutors: string[] = []) {
  jest.spyOn(StudentProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'sp-1' }) as never);
  jest.spyOn(StudentProfileModel, 'find').mockReturnValue(lean([{ publicId: 'sp-1', tutorPublicId: tutor }]) as never);
  jest.spyOn(ScheduledClassModel, 'distinct').mockResolvedValue(classTutors as never);
}

describe('legacy material access', () => {
  afterEach(() => jest.restoreAllMocks());

  it('student sees an "All students" worksheet only from one of their tutors', async () => {
    studentWithTutor('tp-A');
    expect(await canViewMaterial(student, { tutorPublicId: 'tp-A', assignedToStudentPublicIds: [] }, 'worksheet')).toBe(true);
    expect(await canViewMaterial(student, { tutorPublicId: 'tp-Z', assignedToStudentPublicIds: [] }, 'worksheet')).toBe(false);
  });

  it('a tutor they only have classes with also counts as their tutor', async () => {
    studentWithTutor(undefined, ['tp-C']);
    expect(await canViewMaterial(student, { tutorPublicId: 'tp-C', assignedToStudentPublicIds: [] }, 'worksheet')).toBe(true);
  });

  it('student sees a worksheet assigned to them, not one assigned to others', async () => {
    studentWithTutor('tp-A');
    expect(await canViewMaterial(student, { tutorPublicId: 'tp-Z', assignedToStudentPublicIds: ['sp-1'] }, 'worksheet')).toBe(true);
    expect(await canViewMaterial(student, { tutorPublicId: 'tp-A', assignedToStudentPublicIds: ['sp-9'] }, 'worksheet')).toBe(false);
  });

  it('student sees a class assignment only if they are the student of that class', async () => {
    studentWithTutor('tp-A');
    jest.spyOn(ScheduledClassModel, 'exists').mockResolvedValue(null as never);
    expect(await canViewMaterial(student, { tutorPublicId: 'tp-A', classPublicId: 'k-1' }, 'assignment')).toBe(false);
    jest.spyOn(ScheduledClassModel, 'exists').mockResolvedValue({ _id: 'x' } as never);
    expect(await canViewMaterial(student, { tutorPublicId: 'tp-A', classPublicId: 'k-1' }, 'assignment')).toBe(true);
  });

  it('tutors see only their own legacy items; admins see all', async () => {
    jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'tp-A' }) as never);
    expect(await canViewMaterial({ role: 'TUTOR', userPublicId: 'tu-A' }, { tutorPublicId: 'tp-A' }, 'resource')).toBe(true);
    expect(await canViewMaterial({ role: 'TUTOR', userPublicId: 'tu-A' }, { tutorPublicId: 'tp-B' }, 'resource')).toBe(false);
    expect(await canViewMaterial({ role: 'ADMIN', userPublicId: 'a' }, { tutorPublicId: 'tp-B' }, 'resource')).toBe(true);
  });

  it('parents follow their children', async () => {
    jest.spyOn(ParentProfileModel, 'findOne').mockReturnValue(lean({ childStudentPublicIds: ['sp-1'] }) as never);
    jest.spyOn(StudentProfileModel, 'find').mockReturnValue(lean([{ publicId: 'sp-1', tutorPublicId: 'tp-A' }]) as never);
    jest.spyOn(ScheduledClassModel, 'distinct').mockResolvedValue([] as never);
    expect(await canViewMaterial({ role: 'PARENT', userPublicId: 'pu' }, { tutorPublicId: 'tp-A' }, 'resource')).toBe(true);
  });
});

describe('studentMaterialScope with legacy scoping', () => {
  afterEach(() => jest.restoreAllMocks());

  it('worksheets: legacy items assigned to the student or from their tutors, plus active-course curriculum items', async () => {
    studentWithTutor('tp-A', ['tp-C']);
    jest.spyOn(CourseModel, 'find').mockReturnValue(lean([]) as never);
    expect(await studentMaterialScope('sp-1', 'worksheet')).toEqual({
      $or: [
        { curriculumPublicId: { $exists: false }, assignedToStudentPublicIds: 'sp-1' },
        { curriculumPublicId: { $exists: false }, tutorPublicId: { $in: ['tp-A', 'tp-C'] } },
      ],
    });
  });

  it('resources: legacy items from their tutors', async () => {
    studentWithTutor('tp-A');
    jest.spyOn(CourseModel, 'find').mockReturnValue(lean([]) as never);
    expect(await studentMaterialScope('sp-1', 'resource')).toEqual({
      $or: [{ curriculumPublicId: { $exists: false }, tutorPublicId: { $in: ['tp-A'] } }],
    });
  });
});

describe('canViewClass', () => {
  afterEach(() => jest.restoreAllMocks());

  it('allows the class student, their parents, the class tutor and admins only', async () => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean({ publicId: 'k-1', studentPublicId: 'sp-1', tutorPublicId: 'tp-A' }) as never);
    jest.spyOn(StudentProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'sp-1' }) as never);
    expect(await canViewClass(student, 'k-1')).toBe(true);
    jest.spyOn(StudentProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'sp-9' }) as never);
    expect(await canViewClass(student, 'k-1')).toBe(false);
    jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'tp-A' }) as never);
    expect(await canViewClass({ role: 'TUTOR', userPublicId: 'tu' }, 'k-1')).toBe(true);
    expect(await canViewClass({ role: 'ADMIN', userPublicId: 'a' }, 'k-1')).toBe(true);
  });
});

describe('canReadMedia', () => {
  afterEach(() => jest.restoreAllMocks());

  function noRefs() {
    jest.spyOn(MessageModel, 'findOne').mockReturnValue(lean(null) as never);
    jest.spyOn(ResourceModel, 'findOne').mockReturnValue(lean(null) as never);
    jest.spyOn(AssignmentModel, 'findOne').mockReturnValue(lean(null) as never);
    jest.spyOn(WorksheetModel, 'findOne').mockReturnValue(lean(null) as never);
    jest.spyOn(SubmissionModel, 'findOne').mockReturnValue(lean(null) as never);
  }

  it('the uploader and admins can read; a stranger with no link to the file cannot', async () => {
    jest.spyOn(MediaFileModel, 'findOne').mockReturnValue(lean({ publicId: 'm-1', uploaderPublicId: 'u-owner' }) as never);
    noRefs();
    expect(await canReadMedia({ role: 'TUTOR', userPublicId: 'u-owner' }, 'm-1')).toBe(true);
    expect(await canReadMedia({ role: 'SUPER_ADMIN', userPublicId: 'x' }, 'm-1')).toBe(true);
    expect(await canReadMedia(student, 'm-1')).toBe(false);
  });

  it('chat media: conversation participants only', async () => {
    jest.spyOn(MediaFileModel, 'findOne').mockReturnValue(lean({ publicId: 'm-1', uploaderPublicId: 'u-other' }) as never);
    noRefs();
    jest.spyOn(MessageModel, 'findOne').mockReturnValue(lean({ conversationPublicId: 'cv-1' }) as never);
    jest.spyOn(ConversationModel, 'findOne').mockReturnValue(lean({ participantPublicIds: ['u-other', 'su-1'] }) as never);
    expect(await canReadMedia(student, 'm-1')).toBe(true);
    jest.spyOn(ConversationModel, 'findOne').mockReturnValue(lean({ participantPublicIds: ['u-other', 'u-3'] }) as never);
    expect(await canReadMedia(student, 'm-1')).toBe(false);
  });

  it('material files follow the material rules', async () => {
    jest.spyOn(MediaFileModel, 'findOne').mockReturnValue(lean({ publicId: 'm-1', uploaderPublicId: 'u-tutor' }) as never);
    noRefs();
    jest.spyOn(WorksheetModel, 'findOne').mockReturnValue(lean({ publicId: 'w-1', tutorPublicId: 'tp-A', filePublicId: 'm-1' }) as never);
    const can = jest.spyOn(access, 'canViewMaterial').mockResolvedValue(true);
    expect(await canReadMedia(student, 'm-1')).toBe(true);
    expect(can).toHaveBeenCalledWith(student, expect.objectContaining({ publicId: 'w-1' }), 'worksheet');
  });

  it('submission attachments: the submitting student and the grading tutor', async () => {
    jest.spyOn(MediaFileModel, 'findOne').mockReturnValue(lean({ publicId: 'm-1', uploaderPublicId: 'u-x' }) as never);
    noRefs();
    jest.spyOn(SubmissionModel, 'findOne').mockReturnValue(lean({ studentPublicId: 'sp-1', assignmentPublicId: 'a-1', graderTutorPublicId: 'tp-G' }) as never);
    jest.spyOn(StudentProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'sp-1' }) as never);
    expect(await canReadMedia(student, 'm-1')).toBe(true);

    jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'tp-G' }) as never);
    jest.spyOn(AssignmentModel, 'findOne').mockImplementation(((q: Record<string, unknown>) =>
      lean(q.publicId === 'a-1' ? { publicId: 'a-1', tutorPublicId: 'tp-owner' } : null)) as never);
    expect(await canReadMedia({ role: 'TUTOR', userPublicId: 'tu-G' }, 'm-1')).toBe(true);
    jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue(lean({ publicId: 'tp-Z' }) as never);
    expect(await canReadMedia({ role: 'TUTOR', userPublicId: 'tu-Z' }, 'm-1')).toBe(false);
  });
});

describe('routes', () => {
  afterEach(() => jest.restoreAllMocks());

  it('GET /media/:id/read-url 404s without access and never signs a URL', async () => {
    jest.spyOn(MediaFileModel, 'findOne').mockReturnValue(lean(null) as never);
    const sign = jest.spyOn(mediaService, 'getReadUrl');
    expect((await request(app).get('/api/v1/media/m-1/read-url')).status).toBe(404);
    expect(sign).not.toHaveBeenCalled();
  });

  it('GET /assignments/class/:id 404s for a student not in the class', async () => {
    jest.spyOn(access, 'canViewClass').mockResolvedValue(false);
    expect((await request(app).get('/api/v1/assignments/class/k-1')).status).toBe(404);
  });
});
