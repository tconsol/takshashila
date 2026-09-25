// server/src/shared/material.types.ts
/** Links a resource/assignment/worksheet to a curriculum's topics (curriculum-materials spec §3). */
export type MaterialAuthorRole = 'TUTOR' | 'ADMIN';

export interface CurriculumAttachment {
  curriculumPublicId?: string;
  topicPublicIds?: string[];
  authorRole?: MaterialAuthorRole;
  authorUserPublicId?: string;
}

/** The tutor/principal creating a material — enough to validate and stamp the attachment. */
export interface TutorAuthor {
  publicId: string;
  userPublicId: string;
  subjects: string[];
  gradesTaught?: string[];
}
