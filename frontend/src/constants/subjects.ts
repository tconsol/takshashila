// frontend/src/constants/subjects.ts
//
// Canonical subject names offered to tutors (profile suggestions) and admins
// (curriculum subject dropdown). The server normalises both sides with the same
// taxonomy (server/src/utils/taxonomy.ts), so a curriculum and a tutor match on these.
export const SUBJECT_OPTIONS = [
  'Mathematics', 'Physics', 'Chemistry', 'Biology', 'English',
  'Computer Science', 'History', 'Economics', 'Geography',
  'Political Science', 'Sanskrit', 'Hindi', 'Art', 'Music',
];
