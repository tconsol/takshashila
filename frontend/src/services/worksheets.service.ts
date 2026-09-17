import { api } from '../lib/axios';

export interface IQuestion {
  questionText: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
}

export interface Worksheet {
  publicId: string;
  tutorPublicId: string;
  classPublicId?: string;
  title: string;
  subject?: string;
  type: 'WORKSHEET' | 'ASSIGNMENT';
  dueDate?: string;
  questions: IQuestion[];
  isFileAttachment?: boolean;
  filePublicId?: string;
  fileMimeType?: string;
  fileOriginalName?: string;
  assignedToStudentPublicIds: string[];
  status: 'DRAFT' | 'PUBLISHED';
  mySubmission?: WorksheetSubmission;
  createdAt: string;
  updatedAt: string;
}

export interface WorksheetSubmission {
  publicId: string;
  worksheetPublicId: string;
  studentPublicId: string;
  studentName?: string;
  answers: number[];
  score: number;
  correctCount: number;
  totalQuestions: number;
  timeTakenSeconds?: number;
  submittedAt: string;
}

export interface CreateWorksheetDto {
  classPublicId?: string;
  title: string;
  subject?: string;
  type: 'WORKSHEET' | 'ASSIGNMENT';
  dueDate?: string;
  questions?: IQuestion[];
  isFileAttachment?: boolean;
  filePublicId?: string;
  fileMimeType?: string;
  fileOriginalName?: string;
  assignedToStudentPublicIds?: string[];
}

export interface PaginatedWorksheets {
  items: Worksheet[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** The API nests counts under `pagination`; these types expose them flat. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function flattenPage<T>(raw: any): { items: T[]; total: number; page: number; limit: number; totalPages: number } {
  const pagination = raw?.pagination ?? {};
  return {
    items: raw?.items ?? [],
    total: pagination.total ?? 0,
    page: pagination.page ?? 1,
    limit: pagination.limit ?? 0,
    totalPages: pagination.totalPages ?? 0,
  };
}

export const worksheetsService = {
  create: (dto: CreateWorksheetDto) =>
    api.post('/worksheets', dto).then((r) => r.data.data as Worksheet),

  getMyAsTutor: (params?: Record<string, string>) =>
    api.get('/worksheets/my', { params }).then((r) => flattenPage<Worksheet>(r.data.data)),

  getAsPrincipal: (params?: Record<string, string>) =>
    api.get('/worksheets/principal/all', { params })
      .then((r) => flattenPage<Worksheet & { tutorName: string; submissionCount: number }>(r.data.data)),

  getMyAsStudent: (params?: Record<string, string>) =>
    api.get('/worksheets/student/me', { params }).then((r) => flattenPage<Worksheet>(r.data.data)),

  getById: (id: string) =>
    api.get(`/worksheets/${id}`).then((r) => r.data.data as Worksheet),

  delete: (id: string) =>
    api.delete(`/worksheets/${id}`),

  submitAnswers: (id: string, answers: number[], timeTakenSeconds?: number) =>
    api.post(`/worksheets/${id}/submit`, { answers, timeTakenSeconds }).then((r) => r.data.data as WorksheetSubmission),

  getSubmissions: (id: string) =>
    api.get(`/worksheets/${id}/submissions`).then((r) => r.data.data as WorksheetSubmission[]),

  getMySubmission: (id: string) =>
    api.get(`/worksheets/${id}/my-submission`).then((r) => r.data.data as WorksheetSubmission | null),
};
