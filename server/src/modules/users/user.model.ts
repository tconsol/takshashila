import mongoose, { Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { ROLES_LIST } from '../../constants/roles';
import { UserStatus } from './user.types';
import type { IUser } from './user.types';

const userSchema = new Schema<IUser>(
  {
    publicId: { type: String, default: uuidv4, unique: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    role: { type: String, enum: ROLES_LIST, required: true, index: true },
    status: {
      type: String,
      enum: Object.values(UserStatus),
      default: UserStatus.PENDING_VERIFICATION,
      index: true,
    },
    phone: { type: String, trim: true },
    avatarUrl: { type: String },
    timezone: { type: String, default: 'UTC' },
    emailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpiry: { type: Date, select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetExpiry: { type: Date, select: false },
    twoFAEnabled: { type: Boolean, default: false },
    twoFASecret: { type: String, select: false },
    lastLoginAt: { type: Date },
    lastLoginIp: { type: String },
    loginCount: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
    deletedBy: { type: String },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.__v;
        delete ret.passwordHash;
        delete ret.emailVerificationToken;
        delete ret.emailVerificationExpiry;
        delete ret.passwordResetToken;
        delete ret.passwordResetExpiry;
        delete ret.twoFASecret;
        return ret;
      },
    },
  },
);

userSchema.index({ role: 1, status: 1 });
userSchema.index({ createdAt: -1 });

export const UserModel = mongoose.model<IUser>('User', userSchema);
