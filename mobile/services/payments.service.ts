import { api } from '../lib/api';

export interface PaymentConfig {
  stripePublishableKey: string;
  razorpayKeyId: string;
  usdInrRate: number;
}

export interface PaymentOrder {
  publicId: string;
  provider: 'STRIPE' | 'RAZORPAY';
  providerOrderId: string;
  amountCents: number;
  currency: 'USD' | 'INR';
  clientSecret?: string;
}

// NOTE: the /payments routes return the object directly (no { data } envelope).
export const paymentsService = {
  getConfig: (): Promise<PaymentConfig> => api.get('/payments/config').then((r) => r.data),

  createOrder: (dto: {
    creditsCents: number;
    currency: 'USD' | 'INR';
    provider: 'STRIPE' | 'RAZORPAY';
  }): Promise<PaymentOrder> => api.post('/payments/order', dto).then((r) => r.data),

  verify: (dto: {
    publicId: string;
    providerPaymentId: string;
    providerSignature?: string;
  }): Promise<PaymentOrder> => api.post('/payments/verify', dto).then((r) => r.data),
};
