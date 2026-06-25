import { api } from '../lib/axios';

export type PaymentProvider = 'STRIPE' | 'RAZORPAY';
export type PaymentCurrency = 'INR' | 'USD';

export interface PaymentConfig {
  stripePublishableKey: string;
  razorpayKeyId: string;
}

export interface Payment {
  publicId: string;
  provider: PaymentProvider;
  providerOrderId: string;
  providerPaymentId?: string;
  amountCents: number;
  currency: PaymentCurrency;
  status: string;
  createdAt: string;
  /** Present for STRIPE orders — used to confirm the card payment. */
  clientSecret?: string;
}

export interface CreateOrderDto {
  amountCents: number;
  currency: PaymentCurrency;
  provider: PaymentProvider;
}

export interface VerifyDto {
  publicId: string;
  providerPaymentId: string;
  providerSignature?: string;
}

// NOTE: the payment routes return the resource directly (no { data } envelope).
export const paymentsService = {
  getConfig: () => api.get<PaymentConfig>('/payments/config').then((r) => r.data),
  createOrder: (dto: CreateOrderDto) => api.post<Payment>('/payments/order', dto).then((r) => r.data),
  verify: (dto: VerifyDto) => api.post<Payment>('/payments/verify', dto).then((r) => r.data),
  history: () => api.get<Payment[]>('/payments/history').then((r) => r.data),
};
