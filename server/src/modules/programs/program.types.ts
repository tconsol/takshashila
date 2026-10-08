// server/src/modules/programs/program.types.ts
import type { AvailabilityWindow } from '../../shared/availability';
import type { BundleBilling } from '../schedules/schedule.types';

export const ProgramCategory = {
  ACADEMIC: 'ACADEMIC', ARTS: 'ARTS', MUSIC: 'MUSIC', GAMES: 'GAMES', CODING: 'CODING',
  AI_DATA: 'AI_DATA', LANGUAGES: 'LANGUAGES', LIFE_SKILLS: 'LIFE_SKILLS', OTHER: 'OTHER',
} as const;
export type ProgramCategory = (typeof ProgramCategory)[keyof typeof ProgramCategory];

export const ProgramLevel = { BEGINNER: 'BEGINNER', INTERMEDIATE: 'INTERMEDIATE', ADVANCED: 'ADVANCED' } as const;
export type ProgramLevel = (typeof ProgramLevel)[keyof typeof ProgramLevel];

export const ProgramStatus = { DRAFT: 'DRAFT', PUBLISHED: 'PUBLISHED', ARCHIVED: 'ARCHIVED' } as const;
export type ProgramStatus = (typeof ProgramStatus)[keyof typeof ProgramStatus];

export const EnrollmentStatus = { ACTIVE: 'ACTIVE', COMPLETED: 'COMPLETED', CANCELLED: 'CANCELLED' } as const;
export type EnrollmentStatus = (typeof EnrollmentStatus)[keyof typeof EnrollmentStatus];

export interface IProgramModule {
  publicId: string;
  title: string;
  description?: string;
  order: number;
}

export interface IProgram {
  _id: string;
  publicId: string;
  tutorPublicId: string;
  title: string;
  category: ProgramCategory;
  description?: string;
  level: ProgramLevel;
  sessionCount: number;
  sessionMinutes: number;
  priceCents: number;
  maxEnrollees?: number;
  activeEnrollmentCount: number;
  modules: IProgramModule[];
  status: ProgramStatus;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProgramEnrollment {
  _id: string;
  publicId: string;
  programPublicId: string;
  tutorPublicId: string;
  studentPublicId: string;
  availabilityWindow: AvailabilityWindow;
  sessionCount: number;
  priceCentsPaid: number;
  /** HELD: the price is held, not debited, at enroll. Absent: legacy prepaid. */
  billing?: BundleBilling;
  sessionsScheduledCount: number;
  sessionsCompletedCount: number;
  status: EnrollmentStatus;
  cancelledBy?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}
