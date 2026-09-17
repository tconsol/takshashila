import mongoose, { Schema } from 'mongoose';

/**
 * Outcome of every outbound email.
 *
 * Scope note: this records what *our* SMTP handoff told us — accepted,
 * rejected, or failed with an error. It is NOT bounce tracking. A message the
 * relay accepts can still bounce later, and learning about that requires a
 * provider that posts webhooks (SES, Postmark, SendGrid). Until one is wired
 * up, `ACCEPTED` means "handed off successfully", not "landed in the inbox" —
 * the admin view says so rather than implying delivery it cannot verify.
 */

export const EmailStatus = {
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  FAILED: 'FAILED',
} as const;
export type EmailStatus = (typeof EmailStatus)[keyof typeof EmailStatus];

export interface IEmailLog {
  _id: string;
  to: string;
  subject: string;
  status: EmailStatus;
  /** SMTP response or thrown error, truncated. */
  detail?: string;
  messageId?: string;
  attempts: number;
  createdAt: Date;
}

const emailLogSchema = new Schema<IEmailLog>(
  {
    to: { type: String, required: true, index: true },
    subject: { type: String, required: true },
    status: { type: String, enum: Object.values(EmailStatus), required: true, index: true },
    detail: { type: String },
    messageId: { type: String },
    attempts: { type: Number, default: 1 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

emailLogSchema.index({ createdAt: -1 });
emailLogSchema.index({ status: 1, createdAt: -1 });

// Delivery logs are operational, not records of account — expire them so the
// collection cannot grow without bound.
emailLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const EmailLogModel = mongoose.model<IEmailLog>('EmailLog', emailLogSchema);
