import { v4 as uuidv4 } from 'uuid';
import { ParentProfileModel } from './parent.model';
import { buildLocationUpdate } from '../geo/location-update';
import { ParentLinkRequestModel } from './parent-link-request.model';
import { StudentProfileModel } from '../students/student.model';
import { userRepository } from '../users/user.repository';
import { ScheduledClassModel } from '../schedules/schedule.model';
import { AttendanceModel } from '../attendance/attendance.model';
import { AssignmentModel, SubmissionModel } from '../assignments/assignment.model';
import { WorksheetModel, WorksheetSubmissionModel } from '../worksheets/worksheet.model';
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

  /** Link requests this parent has sent that the student has not answered yet. */
  async getMyPendingLinkRequests(parentUserPublicId: string) {
    const requests = await ParentLinkRequestModel.find({
      parentUserPublicId,
      status: 'PENDING',
      isDeleted: false,
    }).sort({ createdAt: -1 }).lean();
    if (requests.length === 0) return [];

    const profiles = await StudentProfileModel.find(
      { publicId: { $in: requests.map((r) => r.studentPublicId) } },
      { publicId: 1, userPublicId: 1, grade: 1 },
    ).lean();
    const users = await userRepository.findManyByPublicIds(profiles.map((p) => p.userPublicId));
    const userMap = new Map(users.map((u) => [u.publicId, u]));
    const profileMap = new Map(profiles.map((p) => [p.publicId, p]));

    return requests.map((r) => {
      const p = profileMap.get(r.studentPublicId);
      const u = p ? userMap.get(p.userPublicId) : undefined;
      return {
        publicId: r.publicId,
        studentPublicId: r.studentPublicId,
        studentName: u ? `${u.firstName} ${u.lastName}`.trim() : 'Student',
        grade: p?.grade,
        createdAt: r.createdAt,
      };
    });
  }

  /** A parent withdraws a request the student has not answered yet. */
  async cancelMyLinkRequest(parentUserPublicId: string, requestPublicId: string): Promise<void> {
    const result = await ParentLinkRequestModel.updateOne(
      { publicId: requestPublicId, parentUserPublicId, status: 'PENDING', isDeleted: false },
      { $set: { isDeleted: true } },
    );
    if (result.matchedCount === 0) throw new NotFoundError('Link request');
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
    dto: { firstName?: string; lastName?: string; grade?: string; state?: string; countyFips?: string },
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
    if (dto.state !== undefined || dto.countyFips !== undefined) {
      // Where the child goes to school decides which state curriculum and county programs they see.
      const { set, unset } = buildLocationUpdate({ state: dto.state, countyFips: dto.countyFips }, studentProfile.state);
      const update: Record<string, unknown> = {};
      if (Object.keys(set).length) update.$set = set;
      if (Object.keys(unset).length) update.$unset = unset;
      if (Object.keys(update).length) await StudentProfileModel.updateOne({ publicId: studentPublicId }, update);
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

    const activeStatuses: string[] = [StudentStatus.ACTIVE, StudentStatus.PENDING_APPROVAL];
    if (
      activeStatuses.includes(studentProfile.status) &&
      (studentProfile.tutorPublicId === tutorPublicId || studentProfile.pendingTutorPublicId === tutorPublicId)
    ) {
      throw new AppError('Request already sent or student already linked to this tutor', 409);
    }
    // Never displace a live tutor, or a tutor's own outstanding invite, via a parent request.
    if (
      studentProfile.tutorPublicId &&
      (studentProfile.status === StudentStatus.ACTIVE || studentProfile.status === StudentStatus.PENDING_APPROVAL)
    ) {
      throw new AppError('Student already has a tutor or a pending tutor invite', 409);
    }

    const tutor = await tutorRepository.findByPublicId(tutorPublicId);
    if (!tutor) throw new NotFoundError('Tutor not found');

    // Store the request separately; tutorPublicId is only set when the student accepts.
    await StudentProfileModel.updateOne(
      { publicId: studentPublicId, isDeleted: false },
      { pendingTutorPublicId: tutorPublicId, status: StudentStatus.PENDING_APPROVAL },
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
      publicId: { $in: assignmentIds },
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

    const student = await StudentProfileModel.findOne({ publicId: studentPublicId, isDeleted: false }).lean();

    // Assigned to this child, or unassigned (empty array = all of that tutor's students)
    // and authored by the child's tutor.
    const visibility: Record<string, unknown>[] = [{ assignedToStudentPublicIds: studentPublicId }];
    if (student?.tutorPublicId) {
      visibility.push({
        assignedToStudentPublicIds: { $size: 0 },
        tutorPublicId: student.tutorPublicId,
      });
    }
    const filter = {
      $or: visibility,
      status: 'PUBLISHED',
      isDeleted: false,
    };

    const [rows, total] = await Promise.all([
      WorksheetModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      WorksheetModel.countDocuments(filter),
    ]);

    const submissions = await WorksheetSubmissionModel.find({
      worksheetPublicId: { $in: rows.map((w) => w.publicId) },
      studentPublicId,
      isDeleted: false,
    }).lean();
    const submissionMap = new Map(submissions.map((s) => [s.worksheetPublicId, s]));
    const items = rows.map((w) => ({ ...w, mySubmission: submissionMap.get(w.publicId) }));
    return buildPaginatedResult(items, total, page, limit);
  }
}

export const parentService = new ParentService();
