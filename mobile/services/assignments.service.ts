import { api } from '../lib/api';
import type { Assignment, AssignmentSubmission } from '../types/api.types';

function pickArr<T>(d: unknown): T[] {
  if (Array.isArray(d)) return d as T[];
  const obj = d as { items?: T[] } | null | undefined;
  return Array.isArray(obj?.items) ? obj!.items! : [];
}

export const assignmentsService = {
  getByClass: (classId: string): Promise<Assignment[]> =>
    api.get(`/assignments/class/${classId}`).then((r) => pickArr<Assignment>(r.data?.data)),

  getMySubmission: (assignmentId: string): Promise<AssignmentSubmission | null> =>
    api.get(`/assignments/${assignmentId}/my-submission`).then((r) => r.data?.data ?? null),

  submit: (
    assignmentId: string,
    dto: { content?: string; attachmentPublicIds?: string[] },
  ): Promise<AssignmentSubmission> =>
    api.post(`/assignments/${assignmentId}/submit`, dto).then((r) => r.data.data),
};
