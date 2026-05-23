import mongoose, { Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import type { Role } from '../../constants/roles';

export interface IAuditLog {
  _id: string;
  publicId: string;
  actorId: string;
  actorRole: Role;
  action: string;
  resourceType: string;
  resourceId: string;
  ip?: string;
  userAgent?: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    publicId: { type: String, default: uuidv4, unique: true },
    actorId: { type: String, required: true, index: true },
    actorRole: { type: String, required: true, index: true },
    action: { type: String, required: true, index: true },
    resourceType: { type: String, required: true, index: true },
    resourceId: { type: String, required: true, index: true },
    ip: { type: String },
    userAgent: { type: String },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });

export const AuditLogModel = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
