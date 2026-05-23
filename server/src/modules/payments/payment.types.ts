export const PaymentProvider = {
  STRIPE: 'STRIPE',
  RAZORPAY: 'RAZORPAY',
} as const;
export type PaymentProvider = (typeof PaymentProvider)[keyof typeof PaymentProvider];

export const PaymentStatus = {
  CREATED: 'CREATED',
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const PaymentCurrency = {
  INR: 'INR',
  USD: 'USD',
} as const;
export type PaymentCurrency = (typeof PaymentCurrency)[keyof typeof PaymentCurrency];

export interface IPayment {
  _id: string;
  publicId: string;
  userPublicId: string;
  provider: PaymentProvider;
  providerOrderId: string;
  providerPaymentId?: string;
  amountCents: number;
  currency: PaymentCurrency;
  status: PaymentStatus;
  metadata?: Record<string, unknown>;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePaymentOrderDto {
  amountCents: number;
  currency: PaymentCurrency;
  provider: PaymentProvider;
  metadata?: Record<string, unknown>;
}

export interface VerifyPaymentDto {
  publicId: string;
  providerPaymentId: string;
  providerSignature?: string;
}
