export const ClassType = {
  DEMO: 'DEMO',
  ONE_ON_ONE: 'ONE_ON_ONE',
  GROUP: 'GROUP',
  RECURRING: 'RECURRING',
  RECORDED: 'RECORDED',
} as const;
export type ClassType = (typeof ClassType)[keyof typeof ClassType];

/**
 * How a class is billed on completion:
 * - STUDENT_REQUESTED: student booked the tutor. Student pays (rate + platform fee),
 *   tutor earns (rate − platform fee). Platform keeps a fee from both sides.
 * - TUTOR_INVITED: LEGACY. Tutor created the class and invited students. Students attend free;
 *   the tutor pays the platform fee (both sides) and earns nothing. No longer created.
 * - TUTOR_REQUESTED: tutor created the class at a per-student price and the student must
 *   accept it first (see RequestStatus). Once accepted it is billed exactly like STUDENT_REQUESTED:
 *   student pays (price + platform fee), tutor earns (price - platform fee), charged on completion.
 * - COURSE_PREPAID: student already paid the full course series up front
 *   (see Course). On completion the student is NOT charged again — only
 *   the tutor earns (rate − platform fee), same math as STUDENT_REQUESTED. On
 *   cancellation (unlike STUDENT_REQUESTED) the class's cost IS refunded, because
 *   it was already collected.
 * - PROGRAM_PREPAID: student paid a Skill Program up front — same rules as COURSE_PREPAID.
 * - COURSE_HELD: new-style course. Nothing is debited when the course is accepted; the
 *   student's credits are HELD (see ReserveService) and each completed class charges the
 *   student `costCents` (no extra fee) and pays the tutor `costCents - fee`. Cancelling
 *   releases the hold, there is nothing to refund.
 * - PROGRAM_HELD: the same, for a Skill Program.
 */
export const BillingMode = {
  STUDENT_REQUESTED: 'STUDENT_REQUESTED',
  TUTOR_INVITED: 'TUTOR_INVITED',
  TUTOR_REQUESTED: 'TUTOR_REQUESTED',
  COURSE_PREPAID: 'COURSE_PREPAID',
  PROGRAM_PREPAID: 'PROGRAM_PREPAID',
  COURSE_HELD: 'COURSE_HELD',
  PROGRAM_HELD: 'PROGRAM_HELD',
} as const;
export type BillingMode = (typeof BillingMode)[keyof typeof BillingMode];

/** Paid up front in bulk (course or skill program): no per-class charge; cancelled classes are refunded. */
export const isPrepaid = (mode: BillingMode | string): boolean =>
  mode === BillingMode.COURSE_PREPAID || mode === BillingMode.PROGRAM_PREPAID;

/** Credits held at accept/enroll and charged one session at a time as each completes. */
export const isHeld = (mode: BillingMode | string): boolean =>
  mode === BillingMode.COURSE_HELD || mode === BillingMode.PROGRAM_HELD;

/** Any course/program class, prepaid or held: same cancellation-fee, attendance and admin-refund rules. */
export const isBundled = (mode: BillingMode | string): boolean => isPrepaid(mode) || isHeld(mode);

/** Value of `billing` on a Course or ProgramEnrollment whose money is held. Absent means prepaid (legacy). */
export const BundleBilling = { HELD: 'HELD' } as const;
export type BundleBilling = (typeof BundleBilling)[keyof typeof BundleBilling];

/**
 * Where a tutor-created class (TUTOR_REQUESTED) stands with its student. Kept apart from
 * ClassStatus on purpose: a pending record is still SCHEDULED, a declined or expired one
 * is CANCELLED, so no list or room code needs to learn a new status. Classes that never
 * needed acceptance (student bookings, legacy, demos, prepaid) have no requestStatus.
 */
export const RequestStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
  EXPIRED: 'EXPIRED',
} as const;
export type RequestStatus = (typeof RequestStatus)[keyof typeof RequestStatus];

/**
 * A recurring request is funded in blocks this long: to accept, the student needs balance
 * for the sessions in the first block; the next block is funded later (see fundedThrough).
 */
export const FUNDING_BLOCK_DAYS = 30;

/** Reminders to fund the next block start this long before its first session; funding opens then too. */
export const FUNDING_REMINDER_DAYS = 15;

export const ClassStatus = {
  SCHEDULED: 'SCHEDULED',
  LIVE: 'LIVE',
  COMPLETED: 'COMPLETED',
  MISSED: 'MISSED',
  CANCELLED: 'CANCELLED',
  RESCHEDULED: 'RESCHEDULED',
  FAILED: 'FAILED',
  /** Ran, but the tutor was not present for the required share of it. No money moves. */
  INCOMPLETE: 'INCOMPLETE',
} as const;
export type ClassStatus = (typeof ClassStatus)[keyof typeof ClassStatus];

/**
 * How a class was closed when nobody closed it. A tutor who ran the class but
 * forgot to press Complete should not lose the session; a class nobody turned
 * up to should not sit open forever.
 */
export const AutoResolution = {
  AUTO_COMPLETED: 'AUTO_COMPLETED',
  AUTO_CANCELLED: 'AUTO_CANCELLED',
} as const;
export type AutoResolution = (typeof AutoResolution)[keyof typeof AutoResolution];

/** Grace period after `endUTC` before the sweep closes a class. */
export const AUTO_RESOLVE_GRACE_MINUTES = 10;

/**
 * How long tutor and student must have been in the room together before the
 * platform will settle a class on its own. Below this the class is held for the
 * tutor to complete or cancel — the money is too ambiguous to move unattended.
 */
export const MIN_SESSION_MINUTES = 30;

export const AvailabilityStatus = {
  AVAILABLE: 'AVAILABLE',
  BOOKED: 'BOOKED',
  BLOCKED: 'BLOCKED',
  CANCELLED: 'CANCELLED',
} as const;
export type AvailabilityStatus = (typeof AvailabilityStatus)[keyof typeof AvailabilityStatus];

export interface IAvailabilitySlot {
  _id: string;
  publicId: string;
  tutorPublicId: string;
  startUTC: Date;
  endUTC: Date;
  ianaTimezone: string;
  durationMinutes: number;
  status: AvailabilityStatus;
  isRecurring: boolean;
  recurringRuleId?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IScheduledClass {
  _id: string;
  publicId: string;
  tutorPublicId: string;
  studentPublicId: string;
  availabilitySlotPublicId?: string;
  classType: ClassType;
  status: ClassStatus;
  startUTC: Date;
  endUTC: Date;
  ianaTimezone: string;
  durationMinutes: number;
  title: string;
  description?: string;
  meetingUrl?: string;
  meetingProvider?: 'zoom' | 'google_meet' | 'native';
  meetingId?: string;
  costCents: number;
  billingMode: BillingMode;
  idempotencyKey: string;
  studentJoinedAt?: Date;
  tutorJoinedAt?: Date;
  /** Shared by the records of one group session (one record per student); they use one live room. */
  groupPublicId?: string;
  /** Request state for tutor-created classes that the student has to accept; absent for other classes. */
  requestStatus?: RequestStatus;
  /** Shared by every session and student of one tutor create call: one series, accepted per student. */
  seriesPublicId?: string;
  /** Price per hour the tutor set for this class (costCents is this scaled by the class length). */
  pricePerHourCents?: number;
  /** End of the funded block: sessions starting before this are covered by the student's hold. */
  fundedThrough?: Date;
  /** When the student accepted or declined, or the request expired. */
  requestRespondedAt?: Date;
  /** Last time the student was reminded to fund the block this session belongs to. */
  fundingReminderAt?: Date;
  /** When the class actually went LIVE, which is not the scheduled start. */
  startedAt?: Date;
  /**
   * Set by the overdue sweep when a class ran but not long enough to settle
   * automatically. It is then held — indefinitely — until the tutor completes
   * or cancels it. No money moves while this is true.
   */
  needsTutorDecision?: boolean;
  cancellationReason?: string;
  cancelledBy?: string;
  rescheduledFromId?: string;
  /**
   * Set when the grace-period sweep closed this class instead of a person.
   * Kept separate from `status` so the UI can label it "Auto completed" /
   * "Auto cancelled" without inventing new statuses that every switch
   * statement in the codebase would then have to handle.
   */
  autoResolution?: AutoResolution;
  autoResolvedAt?: Date;
  /** When the class was completed (and paid). Starts the refund window; see EARNINGS_HOLD_HOURS. */
  completedAt?: Date;
  /** Minutes each person was present inside the scheduled window, kept when presence settled the class. */
  attendedMinutes?: { tutor: number; student: number };
  /** Minutes each person had to attend (the admin percentage of the class length). */
  requiredMinutes?: number;
  /** Billed as completed although this student did not attend the required share (the tutor did). */
  studentLeftEarly?: boolean;
  isRefunded?: boolean;
  refundedAt?: Date;
  /** Completed without payment because billing failed (e.g. student balance short). Admins: filter on this. */
  billingFailed?: boolean;
  /** Set atomically by the class-reminder job so each class is reminded once. */
  reminderSentAt?: Date;
  billingFailureReason?: string;
  /** Set only when this class was scheduled against an accepted Course. */
  coursePublicId?: string;
  curriculumPublicId?: string;
  topicPublicId?: string;
  programEnrollmentPublicId?: string;
  programPublicId?: string;
  programModulePublicId?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAvailabilityDto {
  tutorPublicId: string;
  startUTC: Date;
  endUTC: Date;
  ianaTimezone: string;
  isRecurring?: boolean;
}

export interface BookClassDto {
  tutorPublicId: string;
  studentPublicId: string;
  availabilitySlotPublicId: string;
  classType: ClassType;
  title: string;
  idempotencyKey: string;
}
