export const WorksheetStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
} as const;
export type WorksheetStatus = (typeof WorksheetStatus)[keyof typeof WorksheetStatus];

export const WorksheetType = {
  WORKSHEET: 'WORKSHEET',
  ASSIGNMENT: 'ASSIGNMENT',
} as const;
export type WorksheetType = (typeof WorksheetType)[keyof typeof WorksheetType];

export interface IQuestion {
  questionText: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
}

export interface IWorksheet {
  _id: string;
  publicId: string;
  tutorPublicId: string;
  classPublicId?: string;
  title: string;
  subject?: string;
  type: WorksheetType;
  dueDate?: Date;
  questions: IQuestion[];
  assignedToStudentPublicIds: string[];
  status: WorksheetStatus;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWorksheetSubmission {
  _id: string;
  publicId: string;
  worksheetPublicId: string;
  studentPublicId: string;
  answers: number[];
  score: number;
  correctCount: number;
  totalQuestions: number;
  timeTakenSeconds?: number;
  submittedAt: Date;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWorksheetDto {
  classPublicId?: string;
  title: string;
  subject?: string;
  type: WorksheetType;
  dueDate?: string;
  questions: IQuestion[];
  assignedToStudentPublicIds?: string[];
}

export interface SubmitWorksheetDto {
  answers: number[];
  timeTakenSeconds?: number;
}
