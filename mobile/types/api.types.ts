export type Role = 'STUDENT' | 'TUTOR' | 'PRINCIPAL' | 'ADMIN' | 'SUPER_ADMIN';

export interface User {
  publicId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  status: string;
  phone?: string;
  timezone: string;
  emailVerified: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse extends TokenPair {
  user: User;
}

export interface StudentProfile {
  publicId: string;
  userPublicId: string;
  tutorPublicId?: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  status: string;
  grade?: string;
  notes?: string;
  subjects?: string[];
  demoClassesUsed: number;
  totalClassesAttended: number;
  totalClassesMissed: number;
  totalClassesBooked?: number;
  attendanceRate: number;
  createdAt: string;
}

export type ClassStatus =
  | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export type ClassType = 'DEMO' | 'ONE_ON_ONE' | 'GROUP' | 'RECURRING';

export interface ClassRecord {
  publicId: string;
  tutorPublicId: string;
  studentPublicId: string;
  slotPublicId: string;
  status: ClassStatus;
  classType: ClassType;
  subject: string;
  scheduledStartUTC: string;
  scheduledEndUTC: string;
  meetingUrl?: string;
  costCents: number;
  notes?: string;
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type PaginatedClasses = Paginated<ClassRecord>;

export interface WalletInfo {
  publicId: string;
  balanceCents: number;
  demoCreditsCents?: number;
  regularCreditsCents?: number;
  bonusCreditsCents?: number;
  currency: string;
}

export type TransactionType = 'CREDIT' | 'DEBIT' | 'REFUND';

export interface LedgerEntry {
  publicId: string;
  type: TransactionType;
  amountCents: number;
  description: string;
  balanceAfterCents?: number;
  createdAt: string;
}

export type PaginatedTransactions = Paginated<LedgerEntry>;

export interface TutorSlot {
  publicId: string;
  tutorPublicId: string;
  startUTC: string;
  endUTC: string;
  isBooked: boolean;
}

export interface TutorProfile {
  publicId: string;
  userPublicId: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  bio?: string;
  subjects: string[];
  hourlyRateCents: number;
  isVerified: boolean;
  rating: number;
  totalRatings?: number;
  totalStudents: number;
  totalClassesCompleted: number;
  status?: string;
}

export type AssignmentStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED';
export type SubmissionStatus = 'NOT_SUBMITTED' | 'SUBMITTED' | 'GRADED' | 'LATE';

export interface Assignment {
  publicId: string;
  classPublicId: string;
  title: string;
  description?: string;
  status: AssignmentStatus;
  maxScore: number;
  dueDate?: string;
  createdAt: string;
}

export interface AssignmentSubmission {
  publicId: string;
  assignmentPublicId: string;
  studentPublicId: string;
  status: SubmissionStatus;
  content?: string;
  attachmentPublicIds?: string[];
  score?: number;
  feedback?: string;
  submittedAt?: string;
  gradedAt?: string;
}

export type WorksheetType = 'WORKSHEET' | 'ASSIGNMENT';

export interface WorksheetQuestion {
  publicId: string;
  text: string;
  options: string[];
  correctOptionIndex?: number;
  explanation?: string;
}

export interface WorksheetSummary {
  publicId: string;
  title: string;
  subject?: string;
  type: WorksheetType;
  questionCount: number;
  dueDate?: string;
  createdAt: string;
  mySubmission?: WorksheetSubmission;
}

export interface Worksheet extends WorksheetSummary {
  description?: string;
  questions: WorksheetQuestion[];
}

export interface WorksheetSubmission {
  publicId: string;
  worksheetPublicId: string;
  studentPublicId: string;
  answers: number[];
  correctCount: number;
  totalQuestions: number;
  scorePercent: number;
  timeTakenSeconds?: number;
  submittedAt: string;
}

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'PARTIAL' | 'EXCUSED';

export interface AttendanceRecord {
  publicId: string;
  classPublicId: string;
  status: AttendanceStatus;
  durationMinutes?: number;
  source: 'AUTOMATIC' | 'MANUAL_OVERRIDE';
  remarks?: string;
  createdAt: string;
}

export interface Resource {
  publicId: string;
  title: string;
  description?: string;
  filename: string;
  mimeType: string;
  fileSizeBytes: number;
  createdAt: string;
}

export interface StudentAnalytics {
  upcoming: number;
  completed: number;
  submissions: number;
  attendanceRate: number;
  streakDays?: number;
}

export interface ClassRating {
  publicId: string;
  classPublicId: string;
  score: number;
  comment?: string;
  createdAt: string;
}

export interface ApiError {
  message: string;
  statusCode?: number;
}
