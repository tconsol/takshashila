import { v4 as uuidv4 } from 'uuid';
import { ParentProfileModel } from './parent.model';
import { StudentProfileModel } from '../students/student.model';
import { userRepository } from '../users/user.repository';
import { ScheduledClassModel } from '../schedules/schedule.model';
import { AttendanceModel } from '../attendance/attendance.model';
import { AssignmentModel, SubmissionModel } from '../assignments/assignment.model';
import { WorksheetModel } from '../worksheets/worksheet.model';
import { NotFoundError, AppError } from '../../utils/error';
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

  async linkChild(userPublicId: string, studentPublicId: string): Promise<IParentProfile> {
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
