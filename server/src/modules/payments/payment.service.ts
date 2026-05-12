import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import Stripe from 'stripe';
import Razorpay from 'razorpay';
import { PaymentModel } from './payment.model';
import { PaymentProvider, PaymentStatus, PaymentCurrency } from './payment.types';
import type { IPayment, CreatePaymentOrderDto, VerifyPaymentDto } from './payment.types';
import { walletService } from '../wallets/wallet.service';
import { CreditType } from '../wallets/wallet.types';
import { domainEvents } from '../../events/event-emitter';
import { DomainEvent } from '../../constants/events';
import { logger } from '../../lib/logger';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2024-04-10' as never });

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID ?? '',
  key_secret: process.env.RAZORPAY_KEY_SECRET ?? '',
});

export class PaymentService {
  async createOrder(userPublicId: string, dto: CreatePaymentOrderDto): Promise<IPayment> {
    let providerOrderId: string;

    if (dto.provider === PaymentProvider.STRIPE) {
      const intent = await stripe.paymentIntents.create({
        amount: dto.amountCents,
        currency: dto.currency.toLowerCase(),
        metadata: { userPublicId },
      });
      providerOrderId = intent.id;
    } else {
      const order = await razorpay.orders.create({
        amount: dto.amountCents,
        currency: dto.currency,
        receipt: uuidv4(),
        notes: { userPublicId },
      });
      providerOrderId = order.id;
    }

    const payment = await PaymentModel.create({
      publicId: uuidv4(),
      userPublicId,
      provider: dto.provider,
      providerOrderId,
      amountCents: dto.amountCents,
      currency: dto.currency,
      status: PaymentStatus.CREATED,
      metadata: dto.metadata,
    });

    return payment.toObject();
  }

  async verifyAndCredit(userPublicId: string, dto: VerifyPaymentDto): Promise<IPayment> {
    const payment = await PaymentModel.findOne({ publicId: dto.publicId, userPublicId });
    if (!payment) throw Object.assign(new Error('Payment not found'), { statusCode: 404 });
    if (payment.status === PaymentStatus.SUCCESS) {
      return payment.toObject();
    }

    if (payment.provider === PaymentProvider.RAZORPAY) {
      const expectedSig = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET ?? '')
        .update(`${payment.providerOrderId}|${dto.providerPaymentId}`)
        .digest('hex');
      if (expectedSig !== dto.providerSignature) {
        payment.status = PaymentStatus.FAILED;
        await payment.save();
        throw Object.assign(new Error('Invalid payment signature'), { statusCode: 400 });
      }
    } else {
      const intent = await stripe.paymentIntents.retrieve(payment.providerOrderId);
      if (intent.status !== 'succeeded') {
        payment.status = PaymentStatus.FAILED;
        await payment.save();
        throw Object.assign(new Error('Stripe payment not succeeded'), { statusCode: 400 });
      }
    }

    payment.providerPaymentId = dto.providerPaymentId;
    payment.status = PaymentStatus.SUCCESS;
    await payment.save();

    await walletService.creditWallet({
      ownerPublicId: userPublicId,
      amountCents: payment.amountCents,
      creditType: CreditType.PURCHASED_CREDITS,
      description: `Wallet top-up via ${payment.provider}`,
      idempotencyKey: payment.publicId,
    });

    domainEvents.emit(DomainEvent.PAYMENT_RECEIVED, {
      userPublicId,
      amountCents: payment.amountCents,
      paymentPublicId: payment.publicId,
    });

    return payment.toObject();
  }

  async handleStripeWebhook(rawBody: Buffer, sig: string): Promise<void> {
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET ?? '');
    } catch (e) {
      throw Object.assign(new Error('Invalid webhook signature'), { statusCode: 400 });
    }

    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object as Stripe.PaymentIntent;
      const payment = await PaymentModel.findOne({ providerOrderId: intent.id });
      if (payment && payment.status !== PaymentStatus.SUCCESS) {
        payment.status = PaymentStatus.SUCCESS;
        payment.providerPaymentId = intent.latest_charge as string;
        await payment.save();

        await walletService.creditWallet({
          ownerPublicId: payment.userPublicId,
          amountCents: payment.amountCents,
          creditType: CreditType.PURCHASED_CREDITS,
          description: 'Wallet top-up via Stripe (webhook)',
          idempotencyKey: `webhook-${payment.publicId}`,
        });
      }
    }

    if (event.type === 'payment_intent.payment_failed') {
      const intent = event.data.object as Stripe.PaymentIntent;
      await PaymentModel.updateOne({ providerOrderId: intent.id }, { $set: { status: PaymentStatus.FAILED } });
    }
  }

  async getHistory(userPublicId: string): Promise<IPayment[]> {
    return PaymentModel.find({ userPublicId, isDeleted: false }).sort({ createdAt: -1 }).lean();
  }

  async getClientConfig(): Promise<{ stripePublishableKey: string; razorpayKeyId: string }> {
    return {
      stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? '',
      razorpayKeyId: process.env.RAZORPAY_KEY_ID ?? '',
    };
  }
}

export const paymentService = new PaymentService();
