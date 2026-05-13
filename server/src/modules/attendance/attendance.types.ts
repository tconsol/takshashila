export const AttendanceStatus = {
  PRESENT: 'PRESENT',
  ABSENT: 'ABSENT',
  PARTIAL: 'PARTIAL',
  EXCUSED: 'EXCUSED',
} as const;
export type AttendanceStatus = (typeof AttendanceStatus)[keyof typeof AttendanceStatus];

export const AttendanceSource = {
  AUTOMATIC: 'AUTOMATIC',
  MANUAL_OVERRIDE: 'MANUAL_OVERRIDE',
} as const;
export type AttendanceSource = (typeof AttendanceSource)[keyof typeof AttendanceSource];

export interface IAttendance {
  _id: string;
  publicId: string;
  classPublicId: string;
  studentPublicId: string;
  tutorPublicId: string;
  status: AttendanceStatus;
  source: AttendanceSource;
  joinedAt?: Date;
  leftAt?: Date;
  durationPresentMinutes: number;
  overriddenBy?: string;
  overriddenAt?: Date;
  remarks?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MarkAttendanceDto {
  classPublicId: string;
  studentPublicId: string;
  status: AttendanceStatus;
  joinedAt?: string;
  leftAt?: string;
  durationPresentMinutes?: number;
  remarks?: string;
}

export interface OverrideAttendanceDto {
  status: AttendanceStatus;
  remarks: string;
}
