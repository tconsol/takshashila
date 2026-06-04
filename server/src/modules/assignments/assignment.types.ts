export const AssignmentStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  CLOSED: 'CLOSED',
} as const;
export type AssignmentStatus = (typeof AssignmentStatus)[keyof typeof AssignmentStatus];

export const SubmissionStatus = {
  NOT_SUBMITTED: 'NOT_SUBMITTED',
  SUBMITTED: 'SUBMITTED',
  GRADED: 'GRADED',
  LATE: 'LATE',
} as const;
export type SubmissionStatus = (typeof SubmissionStatus)[keyof typeof SubmissionStatus];

export interface IAssignment {
  _id: string;
  publicId: string;
  classPublicId: string;
  tutorPublicId: string;
  title: string;
  description: string;
  dueDate: Date;
  maxScore: number;
  attachmentPublicIds: string[];
  isFileAttachment: boolean;
  filePublicId?: string;
  fileMimeType?: string;
  fileOriginalName?: string;
  status: AssignmentStatus;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISubmission {
  _id: string;
  publicId: string;
  assignmentPublicId: string;
  studentPublicId: string;
  content?: string;
  attachmentPublicIds: string[];
  submittedAt?: Date;
  score?: number;
  feedback?: string;
  gradedBy?: string;
  gradedAt?: Date;
  status: SubmissionStatus;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAssignmentDto {
  classPublicId: string;
  title: string;
  description: string;
  dueDate: string;
  maxScore?: number;
  attachmentPublicIds?: string[];
  isFileAttachment?: boolean;
  filePublicId?: string;
  fileMimeType?: string;
  fileOriginalName?: string;
}

export interface SubmitAssignmentDto {
  content?: string;
  attachmentPublicIds?: string[];
}

export interface GradeSubmissionDto {
  score: number;
  feedback?: string;
}
