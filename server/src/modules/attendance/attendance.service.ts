import { v4 as uuidv4 } from 'uuid';
import { AttendanceModel } from './attendance.model';
import { AttendanceStatus, AttendanceSource } from './attendance.types';
import type { IAttendance, MarkAttendanceDto, OverrideAttendanceDto } from './attendance.types';
import { ConflictError, NotFoundError } from '../../utils/error';
import { domainEvents } from '../../events/event-emitter';
import { DomainEvent } from '../../constants/events';
import { studentRepository } from '../students/student.repository';
import type { PaginationQuery, PaginatedResult } from '../../shared/types';
import { parsePaginationQuery, buildPaginatedResult } from '../../utils/pagination';

export class AttendanceService {
  async markAttendance(dto: MarkAttendanceDto, tutorPublicId: string): Promise<IAttendance> {
    const existing = await AttendanceModel.findOne({
      classPublicId: dto.classPublicId,
      studentPublicId: dto.studentPublicId,
    });
    if (existing) throw new ConflictError('Attendance already recorded for this student in this class');

    const durationMinutes = dto.durationPresentMinutes ?? 0;

    const attendance = await AttendanceModel.create({
      publicId: uuidv4(),
      classPublicId: dto.classPublicId,
      studentPublicId: dto.studentPublicId,
      tutorPublicId,
      status: dto.status,
      source: AttendanceSource.AUTOMATIC,
      joinedAt: dto.joinedAt ? new Date(dto.joinedAt) : undefined,
      leftAt: dto.leftAt ? new Date(dto.leftAt) : undefined,
      durationPresentMinutes: durationMinutes,
      remarks: dto.remarks,
      isDeleted: false,
    });

    await this.updateStudentStats(dto.studentPublicId, dto.status);

    domainEvents.emit(DomainEvent.ATTENDANCE_MARKED, {
      classPublicId: dto.classPublicId,
      studentPublicId: dto.studentPublicId,
      status: dto.status,
    });

    return attendance.toObject();
  }

  async overrideAttendance(
    publicId: string,
    dto: OverrideAttendanceDto,
    overriddenBy: string,
  ): Promise<IAttendance> {
    const attendance = await AttendanceModel.findOne({ publicId, isDeleted: false });
    if (!attendance) throw new NotFoundError('Attendance record');

    const oldStatus = attendance.status;
    const updated = await AttendanceModel.findOneAndUpdate(
      { publicId },
      {
        $set: {
          status: dto.status,
          source: AttendanceSource.MANUAL_OVERRIDE,
          overriddenBy,
          overriddenAt: new Date(),
          remarks: dto.remarks,
        },
      },
      { new: true },
    ).lean();

    if (oldStatus !== dto.status) {
      await this.updateStudentStats(attendance.studentPublicId, dto.status, oldStatus);
    }

    domainEvents.emit(DomainEvent.ATTENDANCE_OVERRIDDEN, {
      attendancePublicId: publicId,
      overriddenBy,
      oldStatus,
      newStatus: dto.status,
    });

    return updated!;
  }

  async getByClass(classPublicId: string): Promise<IAttendance[]> {
    return AttendanceModel.find({ classPublicId, isDeleted: false })
      .sort({ createdAt: -1 })
      .lean();
  }

  async getByStudent(
    studentPublicId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResult<IAttendance>> {
    const { page, limit, skip } = parsePaginationQuery(query);
    const filter = { studentPublicId, isDeleted: false };

    const [items, total] = await Promise.all([
      AttendanceModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AttendanceModel.countDocuments(filter),
    ]);
    return buildPaginatedResult(items, total, page, limit);
  }

  private async updateStudentStats(
    studentPublicId: string,
    newStatus: AttendanceStatus,
    oldStatus?: AttendanceStatus,
  ): Promise<void> {
    const inc: Record<string, number> = {};

    if (oldStatus) {
      if (oldStatus === AttendanceStatus.PRESENT || oldStatus === AttendanceStatus.PARTIAL) {
        inc.totalClassesAttended = -1;
      } else if (oldStatus === AttendanceStatus.ABSENT) {
        inc.totalClassesMissed = -1;
      }
    }

    if (newStatus === AttendanceStatus.PRESENT || newStatus === AttendanceStatus.PARTIAL) {
      inc.totalClassesAttended = (inc.totalClassesAttended ?? 0) + 1;
    } else if (newStatus === AttendanceStatus.ABSENT) {
      inc.totalClassesMissed = (inc.totalClassesMissed ?? 0) + 1;
    }

    if (Object.keys(inc).length > 0) {
      await studentRepository.incrementStats(studentPublicId, inc as Parameters<typeof studentRepository.incrementStats>[1]);
      await studentRepository.updateAttendanceRate(studentPublicId);
    }
  }
}

export const attendanceService = new AttendanceService();
