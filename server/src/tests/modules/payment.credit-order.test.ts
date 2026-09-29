import crypto from 'crypto';
import { paymentService } from '../../modules/payments/payment.service';
import { PaymentModel } from '../../modules/payments/payment.model';
import { walletService } from '../../modules/wallets/wallet.service';
import { PaymentStatus } from '../../modules/payments/payment.types';

function makePayment(over: Record<string, unknown> = {}) {
  const p: Record<string, unknown> = {
    publicId: 'pay-1', userPublicId: 'u1', provider: 'RAZORPAY', providerOrderId: 'order_1',
    amountCents: 9460, creditsCents: 1000, status: PaymentStatus.CREATED,
    save: jest.fn().mockResolvedValue(undefined),
    ...over,
  };
  p.toObject = () => ({ ...p });
  return p;
}

const sigFor = () =>
  crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET ?? '').update('order_1|pp1').digest('hex');

describe('payment crediting order', () => {
  it('verifyAndCredit credits (idempotent key) BEFORE marking SUCCESS', async () => {
    jest.spyOn(PaymentModel, 'findOne').mockResolvedValue(makePayment() as never);
    const order: string[] = [];
    const credit = jest.spyOn(walletService, 'creditWallet').mockImplementation((async () => { order.push('credit'); return {}; }) as never);
    const upd = jest.spyOn(PaymentModel, 'updateOne').mockImplementation((async () => { order.push('mark'); return { modifiedCount: 1 }; }) as never);

    const res = await paymentService.verifyAndCredit('u1', { publicId: 'pay-1', providerPaymentId: 'pp1', providerSignature: sigFor() } as never);

    expect(order).toEqual(['credit', 'mark']);
    expect(credit).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: 'pay-1', amountCents: 1000 }));
    expect(upd).toHaveBeenCalledWith({ publicId: 'pay-1', status: { $ne: PaymentStatus.SUCCESS } }, expect.anything());
    expect(res.status).toBe(PaymentStatus.SUCCESS);
  });

  it('leaves the payment un-SUCCESS when the credit fails, so a retry can settle it', async () => {
    jest.spyOn(PaymentModel, 'findOne').mockResolvedValue(makePayment() as never);
    jest.spyOn(walletService, 'creditWallet').mockRejectedValue(new Error('crash'));
    const upd = jest.spyOn(PaymentModel, 'updateOne').mockResolvedValue({ modifiedCount: 1 } as never);

    await expect(
      paymentService.verifyAndCredit('u1', { publicId: 'pay-1', providerPaymentId: 'pp1', providerSignature: sigFor() } as never),
    ).rejects.toThrow('crash');
    expect(upd).not.toHaveBeenCalled();
  });

  it('razorpay webhook credits first, then marks SUCCESS', async () => {
    jest.spyOn(PaymentModel, 'findOne').mockResolvedValue(makePayment() as never);
    const order: string[] = [];
    jest.spyOn(walletService, 'creditWallet').mockImplementation((async () => { order.push('credit'); return {}; }) as never);
    jest.spyOn(PaymentModel, 'updateOne').mockImplementation((async () => { order.push('mark'); return { modifiedCount: 1 }; }) as never);
    const body = Buffer.from(JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pp1', order_id: 'order_1' } } } }));
    process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec';
    const sig = crypto.createHmac('sha256', 'whsec').update(body).digest('hex');

    await paymentService.handleRazorpayWebhook(body, sig);
    expect(order).toEqual(['credit', 'mark']);
  });
});
