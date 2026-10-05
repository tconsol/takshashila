import type { ClassRecord } from '../services/classes.service';

/**
 * LIVE beats SCHEDULED beats everything else, so the shown record is the one still actionable.
 * A request the student has not accepted ranks below an accepted one: the tutor can only open
 * the room through a record whose student is in.
 */
const STATUS_RANK: Record<string, number> = { LIVE: 3, IN_PROGRESS: 3, SCHEDULED: 2 };
const rank = (cls: ClassRecord) => (STATUS_RANK[cls.status] ?? 1) * 2 + (cls.requestStatus === 'PENDING' ? 0 : 1);

export interface SessionStudent {
  /** The student profile id, so a make-up session can be set up for the same students. */
  publicId: string;
  name: string;
  /** Absent for classes that never needed the student's acceptance. */
  requestStatus?: ClassRecord['requestStatus'];
}

export type ClassSession = ClassRecord & {
  /** Number of students in this session (1 for a class that is not a group). */
  studentCount: number;
  /** Each student with where their request stands, so the tutor sees who accepted. */
  students: SessionStudent[];
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
    const student: SessionStudent = { publicId: cls.studentPublicId, name: cls.studentName ?? '', requestStatus: cls.requestStatus };
    if (!key) {
      result.push({ ...cls, studentCount: 1, students: [student] });
      continue;
    }
    const known = byGroup.get(key);
    if (!known) {
      byGroup.set(key, { index: result.length, names: cls.studentName ? [cls.studentName] : [] });
      result.push({ ...cls, studentCount: 1, students: [student] });
      continue;
    }
    if (cls.studentName) known.names.push(cls.studentName);
    const shown = result[known.index];
    result[known.index] = {
      ...(rank(cls) > rank(shown) ? cls : shown),
      studentCount: shown.studentCount + 1,
      students: [...shown.students, student],
    };
  }

  for (const { index, names } of byGroup.values()) {
    result[index] = { ...result[index], studentName: names.length ? names.join(', ') : result[index].studentName };
  }
  return result;
}
