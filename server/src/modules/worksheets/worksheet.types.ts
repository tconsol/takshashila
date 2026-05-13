export const WorksheetStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
} as const;
export type WorksheetStatus = (typeof WorksheetStatus)[keyof typeof WorksheetStatus];

export interface IWorksheet {
  _id: string;
  publicId: string;
  tutorPublicId: string;
  title: string;
  description: string;
  content: string;
  fileUrl?: string;
  subject?: string;
  sharedWithStudentPublicIds: string[];
  status: WorksheetStatus;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWorksheetDto {
  title: string;
  description: string;
  content: string;
  fileUrl?: string;
  subject?: string;
  sharedWithStudentPublicIds?: string[];
}

export interface UpdateWorksheetDto {
  title?: string;
  description?: string;
  content?: string;
  fileUrl?: string;
  subject?: string;
  sharedWithStudentPublicIds?: string[];
}
