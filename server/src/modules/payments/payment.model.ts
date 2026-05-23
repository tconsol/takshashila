import mongoose, { Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { PaymentProvider, PaymentStatus, PaymentCurrency } from './payment.types';
import type { IPayment } from './payment.types';

const paymentSchema = new Schema<IPayment>(
  {
    publicId: { type: String, default: uuidv4, unique: true, index: true },
    userPublicId: { type: String, required: true, index: true },
    provider: { type: String, enum: Object.values(PaymentProvider), required: true },
    providerOrderId: { type: String, required: true, index: true },
    providerPaymentId: { type: String },
    amountCents: { type: Number, required: true, min: 1 },
    currency: { type: String, enum: Object.values(PaymentCurrency), required: true },
    status: { type: String, enum: Object.values(PaymentStatus), default: PaymentStatus.CREATED },
    metadata: { type: Schema.Types.Mixed },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { transform: (_doc, ret: Record<string, unknown>) => { delete ret.__v; return ret; } },
  },
);

paymentSchema.index({ userPublicId: 1, createdAt: -1 });

export const PaymentModel = mongoose.model<IPayment>('Payment', paymentSchema);

