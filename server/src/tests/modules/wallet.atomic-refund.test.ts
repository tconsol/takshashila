/* Atomic student refund + tutor clawback, and the booking lock helper.
   Mocks the mongoose session + models (same style as wallet.service.test.ts). */
import mongoose from 'mongoose';
import { WalletService } from '../../modules/wallets/wallet.service';
import { WalletModel } from '../../modules/wallets/wallet.model';
import { WalletTransactionModel } from '../../modules/wallets/wallet-transaction.model';

jest.mock('../../events/event-emitter', () => ({ domainEvents: { emit: jest.fn(), on: jest.fn() } }));

const withSession = (v: unknown) => ({ session: () => Promise.resolve(v) });
const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });
const txDoc = (o: object) => ({ toObject: () => o });

describe('WalletService atomic refund + booking lock', () => {
  const service = new WalletService();
  let session: Record<string, jest.Mock>;
  const dto = {
    studentOwnerPublicId: 'stu', tutorOwnerPublicId: 'tut', refundAmountCents: 2100, clawbackAmountCents: 1900,
    refundDescription: 'r', clawbackDescription: 'c', refundIdempotencyKey: 'rk', clawbackIdempotencyKey: 'ck',
  };

  beforeEach(() => {
    jest.restoreAllMocks();
    session = { startTransaction: jest.fn(), commitTransaction: jest.fn(), abortTransaction: jest.fn(), endSession: jest.fn() };
    jest.spyOn(mongoose, 'startSession').mockResolvedValue(session as never);
  });

  function mockWallets(student: object | null, tutor: object | null) {
    (jest.spyOn(WalletModel, 'findOne') as jest.Mock).mockImplementation((q: { ownerPublicId: string }) =>
      withSession(q.ownerPublicId === 'stu' ? student : tutor));
    return jest.spyOn(WalletModel, 'findByIdAndUpdate').mockResolvedValue({} as never);
  }

  const echoCreate = () =>
    jest.spyOn(WalletTransactionModel, 'create').mockImplementation((async (d: object[]) => [txDoc(d[0])]) as never);

  it('refunds student and claws back tutor in ONE transaction', async () => {
    (jest.spyOn(WalletTransactionModel, 'findOne') as jest.Mock).mockReturnValue(withSession(null));
    const upd = mockWallets({ _id: 's1', publicId: 'sw', balanceCents: 0 }, { _id: 't1', publicId: 'tw', balanceCents: 5000 });
    const create = echoCreate();

    const res = await service.refundWithClawback(dto);

    expect(session.startTransaction).toHaveBeenCalledTimes(1);
    expect(session.commitTransaction).toHaveBeenCalledTimes(1);
    expect(upd).toHaveBeenCalledTimes(2);
    const keys = create.mock.calls.map((c) => (c[0] as unknown as Array<{ idempotencyKey: string }>)[0].idempotencyKey);
    expect(keys).toEqual(['rk', 'ck']);
    expect(res.clawbackSkipped).toBe(false);
  });

  it('tutor balance too small: student refunded in full, clawback skipped whole (not partial)', async () => {
    (jest.spyOn(WalletTransactionModel, 'findOne') as jest.Mock).mockReturnValue(withSession(null));
    const upd = mockWallets({ _id: 's1', publicId: 'sw', balanceCents: 0 }, { _id: 't1', publicId: 'tw', balanceCents: 100 });
    const create = echoCreate();

    const res = await service.refundWithClawback(dto);

    expect(res.clawbackSkipped).toBe(true);
    expect(upd).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
    expect(session.commitTransaction).toHaveBeenCalled();
  });

  it('idempotent: both legs already recorded, so no writes', async () => {
    (jest.spyOn(WalletTransactionModel, 'findOne') as jest.Mock).mockReturnValue(withSession(txDoc({ publicId: 'x' })));
    const upd = jest.spyOn(WalletModel, 'findByIdAndUpdate').mockResolvedValue({} as never);
    const create = jest.spyOn(WalletTransactionModel, 'create');

    const res = await service.refundWithClawback(dto);

    expect(upd).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(res.clawbackSkipped).toBe(false);
  });

  it('a failure on the tutor leg aborts the whole transaction', async () => {
    (jest.spyOn(WalletTransactionModel, 'findOne') as jest.Mock).mockReturnValue(withSession(null));
    mockWallets({ _id: 's1', publicId: 'sw', balanceCents: 0 }, { _id: 't1', publicId: 'tw', balanceCents: 5000 });
    jest.spyOn(WalletTransactionModel, 'create')
      .mockImplementationOnce((async (d: object[]) => [txDoc(d[0])]) as never)
      .mockRejectedValueOnce(new Error('boom'));

    await expect(service.refundWithClawback(dto)).rejects.toThrow('boom');
    expect(session.abortTransaction).toHaveBeenCalled();
    expect(session.commitTransaction).not.toHaveBeenCalled();
  });

  it('runWithBookingLock writes bookingSeq first, then runs fn inside the transaction', async () => {
    const withTransaction = jest.fn(async (cb: () => Promise<void>) => { await cb(); });
    jest.spyOn(mongoose, 'startSession').mockResolvedValue({ withTransaction, endSession: jest.fn() } as never);
    const upd = jest.spyOn(WalletModel, 'findOneAndUpdate').mockReturnValue(lean({ balanceCents: 900 }) as never);
    const fn = jest.fn().mockResolvedValue('ok');

    await expect(service.runWithBookingLock('stu', fn)).resolves.toBe('ok');

    expect(upd.mock.calls[0][1]).toEqual({ $inc: { bookingSeq: 1 } });
    expect(fn).toHaveBeenCalledWith(expect.objectContaining({ wallet: { balanceCents: 900 } }));
  });
});
