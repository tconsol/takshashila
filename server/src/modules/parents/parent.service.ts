import { v4 as uuidv4 } from 'uuid';
import { ParentProfileModel } from './parent.model';
import { ParentLinkRequestModel } from './parent-link-request.model';
import { StudentProfileModel } from '../students/student.model';
import { userRepository } from '../users/user.repository';
import { ScheduledClassModel } from '../schedules/schedule.model';
import { AttendanceModel } from '../attendance/attendance.model';
import { AssignmentModel, SubmissionModel } from '../assignments/assignment.model';
import { WorksheetModel } from '../worksheets/worksheet.model';
import { NotFoundError, AppError } from '../../utils/error';
import { studentService } from '../students/student.service';
import { tutorRepository } from '../tutors/tutor.repository';
import { StudentStatus } from '../students/student.types';
import type { CreateStudentByParentDto } from '../students/student.validators';
import type { IParentProfile } from './parent.types';
import type { PaginationQuery, PaginatedResult } from '../../shared/types';
import { parsePaginationQuery, buildPaginatedResult } from '../../utils/pagination';

export class ParentService {
  async getOrCreateProfile(userPublicId: string): Promise<IParentProfile> {
    let profile = await ParentProfileModel.findOne({ userPublicId, isDeleted: false }).lean();
    if (!profile) {
      profile = (await ParentProfileModel.create({
        publicId: uuidv4(),
        userPublicId,
        childStudentPublicIds: [],
      })).toObject();
    }
    return profile;
  }

  async getProfile(userPublicId: string): Promise<IParentProfile> {
    const profile = await ParentProfileModel.findOne({ userPublicId, isDeleted: false }).lean();
    if (!profile) throw new NotFoundError('Parent profile not found');
    return profile;
  }

  async requestLinkChild(userPublicId: string, identifier: string): Promise<void> {
    let studentPublicId = identifier;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    if (!isUUID) {
      const studentUser = await userRepository.findByStudentId(identifier.trim().toLowerCase());
      if (!studentUser) throw new NotFoundError('Student not found with that Student ID');
      const studentProfile = await StudentProfileModel.findOne({ userPublicId: studentUser.publicId, isDeleted: false }).lean();
      if (!studentProfile) throw new NotFoundError('Student profile not found for that Student ID');
      studentPublicId = studentProfile.publicId;
    } else {
      const studentExists = await StudentProfileModel.findOne({ publicId: studentPublicId, isDeleted: false }).lean();
      if (!studentExists) throw new NotFoundError('Student not found with that ID');
    }

    const profile = await this.getOrCreateProfile(userPublicId);
    if (profile.childStudentPublicIds.includes(studentPublicId)) {
      throw new AppError('Child already linked to this account', 409);
    }

    const existing = await ParentLinkRequestModel.findOne({
      parentUserPublicId: userPublicId,
      studentPublicId,
      status: 'PENDING',
      isDeleted: false,
    }).lean();
    if (existing) throw new AppError('A pending request already exists for this student', 409);

    await ParentLinkRequestModel.create({
      publicId: uuidv4(),
      parentUserPublicId: userPublicId,
      studentPublicId,
      status: 'PENDING',
    });
  }

  async getParentLinkRequests(studentPublicId: string) {
    const requests = await ParentLinkRequestModel.find({
      studentPublicId,
      status: 'PENDING',
      isDeleted: false,
    }).sort({ createdAt: -1 }).lean();

    if (requests.length === 0) return [];

    const parentUserPublicIds = requests.map((r) => r.parentUserPublicId);
    const users = await userRepository.findManyByPublicIds(parentUserPublicIds);
    const userMap = new Map(users.map((u) => [u.publicId, u]));

    return requests.map((r) => {
      const u = userMap.get(r.parentUserPublicId);
      return {
        publicId: r.publicId,
        status: r.status,
        createdAt: r.createdAt,
        parent: {
          userPublicId: r.parentUserPublicId,
          firstName: u?.firstName ?? '',
          lastName: u?.lastName ?? '',
          email: u?.email ?? '',
        },
      };
    });
  }

  async approveParentLinkRequest(studentPublicId: string, requestPublicId: string): Promise<void> {
    const request = await ParentLinkRequestModel.findOne({
      publicId: requestPublicId,
      studentPublicId,
      status: 'PENDING',
      isDeleted: false,
    }).lean();
    if (!request) throw new NotFoundError('Link request not found');

    await ParentLinkRequestModel.updateOne({ publicId: requestPublicId }, { status: 'APPROVED' });

    const existingProfile = await ParentProfileModel.findOne({ userPublicId: request.parentUserPublicId, isDeleted: false }).lean();
    if (existingProfile) {
      await ParentProfileModel.updateOne(
        { userPublicId: request.parentUserPublicId, isDeleted: false },
        { $addToSet: { childStudentPublicIds: studentPublicId } },
      );
    } else {
      await ParentProfileModel.create({
        publicId: uuidv4(),
        userPublicId: request.parentUserPublicId,
        childStudentPublicIds: [studentPublicId],
      });
    }
  }

  async rejectParentLinkRequest(studentPublicId: string, requestPublicId: string): Promise<void> {
    const request = await ParentLinkRequestModel.findOne({
      publicId: requestPublicId,
      studentPublicId,
      status: 'PENDING',
      isDeleted: false,
    }).lean();
    if (!request) throw new NotFoundError('Link request not found');

    await ParentLinkRequestModel.updateOne({ publicId: requestPublicId }, { status: 'REJECTED' });
  }

  async linkChild(userPublicId: string, identifier: string): Promise<IParentProfile> {
    // Resolve identifier: UUID → use directly; studentId (e.g. stujs4821) → look up
    let studentPublicId = identifier;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    if (!isUUID) {
      const studentUser = await userRepository.findByStudentId(identifier.trim().toLowerCase());
      if (!studentUser) throw new NotFoundError('Student not found with that Student ID');
      const studentProfile = await StudentProfileModel.findOne({ userPublicId: studentUser.publicId, isDeleted: false }).lean();
      if (!studentProfile) throw new NotFoundError('Student profile not found for that Student ID');
      studentPublicId = studentProfile.publicId;
    }

    const profile = await this.getOrCreateProfile(userPublicId);

    if (profile.childStudentPublicIds.includes(studentPublicId)) {
      throw new AppError('Child already linked to this account', 409);
    }

    const studentExists = await StudentProfileModel.findOne({ publicId: studentPublicId, isDeleted: false }).lean();
    if (!studentExists) throw new NotFoundError('Student not found with that ID');

    const updated = await ParentProfileModel.findOneAndUpdate(
      { userPublicId, isDeleted: false },
      { $addToSet: { childStudentPublicIds: studentPublicId } },
      { new: true },
    ).lean();

    return updated!;
  }

  async createChild(
    parentUserPublicId: string,
    dto: CreateStudentByParentDto,
  ) {
    const result = await studentService.createByParent(parentUserPublicId, dto);

    // Auto-link the newly created child to the parent
    const profile = await this.getOrCreateProfile(parentUserPublicId);
    await ParentProfileModel.findOneAndUpdate(
      { userPublicId: parentUserPublicId, isDeleted: false },
      { $addToSet: { childStudentPublicIds: result.publicId } },
      { new: true },
    );

    return result;
  }

  async updateChild(
    parentUserPublicId: string,
    studentPublicId: string,
    dto: { firstName?: string; lastName?: string; grade?: string },
  ): Promise<void> {
    await this.assertChildAccess(parentUserPublicId, studentPublicId);
    const studentProfile = await StudentProfileModel.findOne({ publicId: studentPublicId, isDeleted: false }).lean();
    if (!studentProfile) throw new NotFoundError('Student profile');

    if (dto.firstName !== undefined || dto.lastName !== undefined) {
      await userRepository.update(studentProfile.userPublicId, {
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
      });
    }
    if (dto.grade !== undefined) {
      await StudentProfileModel.updateOne({ publicId: studentPublicId }, { grade: dto.grade || undefined });
    }
  }

  async unlinkChild(userPublicId: string, studentPublicId: string): Promise<IParentProfile> {
    const updated = await ParentProfileModel.findOneAndUpdate(
      { userPublicId, isDeleted: false },
      { $pull: { childStudentPublicIds: studentPublicId } },
      { new: true },
    ).lean();
    if (!updated) throw new NotFoundError('Parent profile not found');
    return updated;
  }

  async getChildren(userPublicId: string) {
    const profile = await this.getOrCreateProfile(userPublicId);
    if (profile.childStudentPublicIds.length === 0) return [];

    const students = await StudentProfileModel.find({
      publicId: { $in: profile.childStudentPublicIds },
      isDeleted: false,
    }).lean();

    const userPublicIds = students.map((s) => s.userPublicId);
    const users = await userRepository.findManyByPublicIds(userPublicIds);
    const userMap = new Map(users.map((u) => [u.publicId, u]));

    return students.map((s) => {
      const u = userMap.get(s.userPublicId);
      return { ...s, firstName: u?.firstName ?? '', lastName: u?.lastName ?? '' };
    });
  }

  async requestTutorForChild(
    parentUserPublicId: string,
    studentPublicId: string,
    tutorPublicId: string,
  ): Promise<void> {
    await this.assertChildAccess(parentUserPublicId, studentPublicId);

    const studentProfile = await StudentProfileModel.findOne({ publicId: studentPublicId, isDeleted: false }).lean();
    if (!studentProfile) throw new NotFoundError('Student profile');

    if ([StudentStatus.ACTIVE, StudentStatus.PENDING_APPROVAL].includes(studentProfile.status as StudentStatus) && studentProfile.tutorPublicId === tutorPublicId) {
      throw new AppError('Request already sent or student already linked to this tutor', 409);
    }

    const tutor = await tutorRepository.findByPublicId(tutorPublicId);
    if (!tutor) throw new NotFoundError('Tutor not found');

    await StudentProfileModel.updateOne(
      { publicId: studentPublicId, isDeleted: false },
      { tutorPublicId, status: StudentStatus.PENDING_APPROVAL },
    );
  }

  async assertChildAccess(userPublicId: string, studentPublicId: string): Promise<void> {
    const profile = await this.getOrCreateProfile(userPublicId);
    if (!profile.childStudentPublicIds.includes(studentPublicId)) {
      throw new AppError('You do not have access to this student', 403);
    }
  }

  async getChildClasses(
    parentUserPublicId: string,
    studentPublicId: string,
    query: PaginationQuery & { status?: string },
  ): Promise<PaginatedResult<object>> {
    await this.assertChildAccess(parentUserPublicId, studentPublicId);
    const { page, limit, skip } = parsePaginationQuery(query);
    const filter: Record<string, unknown> = { studentPublicId, isDeleted: false };
    if (query.status) filter.status = query.status;

    const [items, total] = await Promise.all([
      ScheduledClassModel.find(filter).sort({ startUTC: -1 }).skip(skip).limit(limit).lean(),
      ScheduledClassModel.countDocuments(filter),
    ]);
    return buildPaginatedResult(items, total, page, limit);
  }

  async getChildAttendance(
    parentUserPublicId: string,
    studentPublicId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResult<object>> {
    await this.assertChildAccess(parentUserPublicId, studentPublicId);
    const { page, limit, skip } = parsePaginationQuery(query);
    const filter = { studentPublicId, isDeleted: false };

    const [items, total] = await Promise.all([
      AttendanceModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AttendanceModel.countDocuments(filter),
    ]);
    return buildPaginatedResult(items, total, page, limit);
  }

  async getChildAssignments(
    parentUserPublicId: string,
    studentPublicId: string,
  ): Promise<object[]> {
    await this.assertChildAccess(parentUserPublicId, studentPublicId);

    const submissions = await SubmissionModel.find({ studentPublicId, isDeleted: false }).lean();
    const assignmentIds = submissions.map((s) => s.assignmentPublicId);
    const assignments = await AssignmentModel.find({
      $or: [
        { publicId: { $in: assignmentIds } },
      ],
      status: 'PUBLISHED',
      isDeleted: false,
    }).lean();

    return assignments.map((a) => ({
      ...a,
      submission: submissions.find((s) => s.assignmentPublicId === a.publicId) ?? null,
    }));
  }

  async getChildWorksheets(
    parentUserPublicId: string,
    studentPublicId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResult<object>> {
    await this.assertChildAccess(parentUserPublicId, studentPublicId);
    const { page, limit, skip } = parsePaginationQuery(query);

    const filter = {
      $or: [
        { sharedWithStudentPublicIds: studentPublicId },
        { sharedWithStudentPublicIds: { $size: 0 } },
      ],
      status: 'PUBLISHED',
      isDeleted: false,
    };

    const [items, total] = await Promise.all([
      WorksheetModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      WorksheetModel.countDocuments(filter),
    ]);
    return buildPaginatedResult(items, total, page, limit);
  }
}

export const parentService = new ParentService();
