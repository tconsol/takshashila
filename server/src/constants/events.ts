export const DomainEvent = {
  // ─── Auth ─────────────────────────────────────────────
  USER_REGISTERED: 'USER_REGISTERED',
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGOUT: 'USER_LOGOUT',
  USER_PASSWORD_RESET: 'USER_PASSWORD_RESET',
  USER_EMAIL_VERIFIED: 'USER_EMAIL_VERIFIED',
  SUSPICIOUS_LOGIN: 'SUSPICIOUS_LOGIN',

  // ─── User Lifecycle ───────────────────────────────────
  USER_ACTIVATED: 'USER_ACTIVATED',
  USER_SUSPENDED: 'USER_SUSPENDED',
  USER_ROLE_CHANGED: 'USER_ROLE_CHANGED',

  // ─── Student ──────────────────────────────────────────
  STUDENT_INVITED: 'STUDENT_INVITED',
  STUDENT_APPROVED: 'STUDENT_APPROVED',
  STUDENT_TRANSFERRED: 'STUDENT_TRANSFERRED',
  STUDENT_INACTIVATED: 'STUDENT_INACTIVATED',

  // ─── Classes ──────────────────────────────────────────
  CLASS_BOOKED: 'CLASS_BOOKED',
  CLASS_CREATED_BY_TUTOR: 'CLASS_CREATED_BY_TUTOR',
  CLASS_STARTED: 'CLASS_STARTED',
  CLASS_COMPLETED: 'CLASS_COMPLETED',
  CLASS_CANCELLED: 'CLASS_CANCELLED',
  CLASS_RESCHEDULED: 'CLASS_RESCHEDULED',
  CLASS_MISSED: 'CLASS_MISSED',

  // ─── Demo ─────────────────────────────────────────────
  DEMO_USED: 'DEMO_USED',
  DEMO_EXPIRED: 'DEMO_EXPIRED',
  DEMO_REQUEST_CREATED: 'DEMO_REQUEST_CREATED',
  DEMO_REQUEST_ACCEPTED: 'DEMO_REQUEST_ACCEPTED',
  DEMO_REQUEST_REJECTED: 'DEMO_REQUEST_REJECTED',

  // ─── Attendance ───────────────────────────────────────
  ATTENDANCE_MARKED: 'ATTENDANCE_MARKED',
  ATTENDANCE_OVERRIDDEN: 'ATTENDANCE_OVERRIDDEN',

  // ─── Wallet ───────────────────────────────────────────
  CREDITS_ADDED: 'CREDITS_ADDED',
  CREDITS_DEDUCTED: 'CREDITS_DEDUCTED',
  CREDITS_REFUNDED: 'CREDITS_REFUNDED',

  // ─── Payments ─────────────────────────────────────────
  PAYMENT_INITIATED: 'PAYMENT_INITIATED',
  PAYMENT_RECEIVED: 'PAYMENT_RECEIVED',
  PAYMENT_COMPLETED: 'PAYMENT_COMPLETED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',

  // ─── Payouts ──────────────────────────────────────────
  PAYOUT_INITIATED: 'PAYOUT_INITIATED',
  PAYOUT_COMPLETED: 'PAYOUT_COMPLETED',
  PAYOUT_FAILED: 'PAYOUT_FAILED',

  // ─── Notifications ────────────────────────────────────
  NOTIFICATION_SENT: 'NOTIFICATION_SENT',

  // ─── Ratings ──────────────────────────────────────────
  TUTOR_RATED: 'TUTOR_RATED',

  // ─── Assignments ──────────────────────────────────────
  ASSIGNMENT_CREATED: 'ASSIGNMENT_CREATED',
  ASSIGNMENT_SUBMITTED: 'ASSIGNMENT_SUBMITTED',
  ASSIGNMENT_GRADED: 'ASSIGNMENT_GRADED',

  // ─── Principal ────────────────────────────────────────
  PRINCIPAL_APPROVED: 'PRINCIPAL_APPROVED',
  PRINCIPAL_SUSPENDED: 'PRINCIPAL_SUSPENDED',

  // ─── Slots ────────────────────────────────────────────
  SLOT_CREATED: 'SLOT_CREATED',
  SLOT_CANCELLED: 'SLOT_CANCELLED',
  SLOT_RESCHEDULED: 'SLOT_RESCHEDULED',
  SLOT_EXPIRED: 'SLOT_EXPIRED',

  // ─── Join Requests ─────────────────────────────────────
  JOIN_REQUEST_SENT: 'JOIN_REQUEST_SENT',
  JOIN_REQUEST_APPROVED: 'JOIN_REQUEST_APPROVED',
  JOIN_REQUEST_REJECTED: 'JOIN_REQUEST_REJECTED',

  // ─── Support ──────────────────────────────────────────
  TICKET_CREATED: 'TICKET_CREATED',
  TICKET_ESCALATED: 'TICKET_ESCALATED',
  TICKET_RESOLVED: 'TICKET_RESOLVED',
} as const;

export type DomainEvent = (typeof DomainEvent)[keyof typeof DomainEvent];
