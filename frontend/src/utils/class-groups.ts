import type { ClassRecord } from '../services/classes.service';

/** LIVE beats SCHEDULED beats everything else, so the shown record is the one still actionable. */
const STATUS_RANK: Record<string, number> = { LIVE: 3, IN_PROGRESS: 3, SCHEDULED: 2 };
const rank = (status: string) => STATUS_RANK[status] ?? 1;

export type ClassSession = ClassRecord & {
  /** Number of students in this session (1 for a class that is not a group). */
  studentCount: number;
};

/**
 * A group session is stored as one class per student, all sharing a groupPublicId.
 * For a list that is a single session, collapse them into one row that names every
 * student. The row keeps one record's id: completing or cancelling it applies to
 * the whole session on the server.
 */
export function collapseGroupSessions(classes: ClassRecord[]): ClassSession[] {
  const result: ClassSession[] = [];
  const byGroup = new Map<string, { index: number; names: string[] }>();

  for (const cls of classes) {
    const key = cls.groupPublicId;
    if (!key) {
      result.push({ ...cls, studentCount: 1 });
      continue;
    }
    const known = byGroup.get(key);
    if (!known) {
      byGroup.set(key, { index: result.length, names: cls.studentName ? [cls.studentName] : [] });
      result.push({ ...cls, studentCount: 1 });
      continue;
    }
    if (cls.studentName) known.names.push(cls.studentName);
    const shown = result[known.index];
    result[known.index] = {
      ...(rank(cls.status) > rank(shown.status) ? cls : shown),
      studentCount: shown.studentCount + 1,
    };
  }

  for (const { index, names } of byGroup.values()) {
    result[index] = { ...result[index], studentName: names.length ? names.join(', ') : result[index].studentName };
  }
  return result;
}
