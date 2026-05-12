import { api } from '../lib/axios';

export interface Assignment {
  publicId: string;
  classPublicId: string;
  tutorPublicId: string;
  title: string;
  description: string;
  dueDate: string;
  maxScore: number;
  attachmentPublicIds: string[];
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED';
  createdAt: string;
}

export interface Submission {
  publicId: string;
  assignmentPublicId: string;
  studentPublicId: string;
  content?: string;
  attachmentPublicIds: string[];
  submittedAt?: string;
  score?: number;
  feedback?: string;
  gradedBy?: string;
  gradedAt?: string;
  status: 'NOT_SUBMITTED' | 'SUBMITTED' | 'GRADED' | 'LATE';
  createdAt: string;
}

export interface CreateAssignmentDto {
  classPublicId: string;
  title: string;
  description: string;
  dueDate: string;
  maxScore?: number;
  attachmentPublicIds?: string[];
}

export const assignmentsService = {
  create: (dto: CreateAssignmentDto) =>
    api.post<{ data: Assignment }>('/assignments', dto).then((r) => r.data.data),

  getMyAssignments: () =>
    api.get<{ data: Assignment[] }>('/assignments/my').then((r) => r.data.data),

  getByClass: (classId: string) =>
    api.get<{ data: Assignment[] }>(`/assignments/class/${classId}`).then((r) => r.data.data),

  getById: (id: string) =>
    api.get<{ data: Assignment }>(`/assignments/${id}`).then((r) => r.data.data),

  publish: (id: string) =>
    api.post<{ data: Assignment }>(`/assignments/${id}/publish`).then((r) => r.data.data),

  close: (id: string) =>
    api.post<{ data: Assignment }>(`/assignments/${id}/close`).then((r) => r.data.data),

  delete: (id: string) =>
    api.delete(`/assignments/${id}`),

  getSubmissions: (assignmentId: string) =>
    api.get<{ data: Submission[] }>(`/assignments/${assignmentId}/submissions`).then((r) => r.data.data),

  submit: (assignmentId: string, dto: { content?: string; attachmentPublicIds?: string[] }) =>
    api.post<{ data: Submission }>(`/assignments/${assignmentId}/submit`, dto).then((r) => r.data.data),

  getMySubmission: (assignmentId: string) =>
    api.get<{ data: Submission | null }>(`/assignments/${assignmentId}/my-submission`).then((r) => r.data.data),

  gradeSubmission: (submissionId: string, dto: { score: number; feedback?: string }) =>
    api.patch<{ data: Submission }>(`/assignments/submissions/${submissionId}/grade`, dto).then((r) => r.data.data),
};

