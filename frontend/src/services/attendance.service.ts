import { api } from '../lib/axios';

export interface AttendanceRecord {
  publicId: string;
  classPublicId: string;
  studentPublicId: string;
  tutorPublicId: string;
  status: 'PRESENT' | 'ABSENT' | 'PARTIAL' | 'EXCUSED';
  source: 'AUTOMATIC' | 'MANUAL_OVERRIDE';
  durationPresentMinutes: number;
  joinedAt?: string;
  leftAt?: string;
  remarks?: string;
  overriddenBy?: string;
  overriddenAt?: string;
  createdAt: string;
}

export const attendanceService = {
  markAttendance: (dto: {
    classPublicId: string;
    studentPublicId: string;
    status: string;
    durationPresentMinutes?: number;
    joinedAt?: string;
    leftAt?: string;
    remarks?: string;
  }) =>
    api.post<{ data: AttendanceRecord }>('/attendance/mark', dto).then((r) => r.data.data),

  overrideAttendance: (attendanceId: string, dto: { status: string; remarks: string }) =>
    api.patch<{ data: AttendanceRecord }>(`/attendance/${attendanceId}/override`, dto).then((r) => r.data.data),

  getByClass: (classId: string) =>
    api.get<{ data: AttendanceRecord[] }>(`/attendance/class/${classId}`).then((r) => r.data.data),

  getMyHistory: (params?: { page?: number; limit?: number }) =>
    api.get<{ data: { items: AttendanceRecord[]; pagination: { page: number; limit: number; total: number; totalPages: number } } }>(
      '/attendance/my',
      { params },
    ).then((r) => r.data.data),

  getMyHistoryAsTutor: (params?: { page?: number; limit?: number }) =>
    api.get<{ data: { items: AttendanceRecord[]; pagination: { page: number; limit: number; total: number; totalPages: number } } }>(
      '/attendance/tutor/my',
      { params },
    ).then((r) => r.data.data),
};

