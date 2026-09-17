/* Wallet debit/credit guards the money primitives.
   Mocks the mongoose session + models so we test the balance/idempotency/lock
   logic without a live DB. */
import mongoose from 'mongoose';
import { WalletService } from '../../modules/wallets/wallet.service';
import { WalletModel } from '../../modules/wallets/wallet.model';
import { WalletTransactionModel } from '../../modules/wallets/wallet-transaction.model';
import { CreditType } from '../../modules/wallets/wallet.types';

jest.mock('../../events/event-emitter', () => ({ domainEvents: { emit: jest.fn() } }));

// chainable `.session()` helper for queries
const withSession = (v: unknown) => ({ session: () => Promise.resolve(v) });

describe('WalletService', () => {
  let service: WalletService;

  beforeEach(() => {
    jest.restoreAllMocks();
    service = new WalletService();
    jest.spyOn(mongoose, 'startSession').mockResolvedValue({
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    } as never);
  });

  describe('debitWallet', () => {
    it('throws 402 on insufficient balance', async () => {
      (jest.spyOn(WalletTransactionModel, 'findOne') as jest.Mock).mockReturnValue(withSession(null));
      (jest.spyOn(WalletModel, 'findOne') as jest.Mock).mockReturnValue(withSession({ _id: 'w1', publicId: 'wp1', balanceCents: 500, isLocked: false }));

      await expect(
        service.debitWallet({ ownerPublicId: 'u1', amountCents: 2000, description: 'x', idempotencyKey: 'k1' } as never),
      ).rejects.toMatchObject({ statusCode: 402 });
    });

    it('is idempotent returns existing tx, does not double-charge', async () => {
      const existing = { toObject: () => ({ publicId: 'tx-existing', amountCents: 2000 }) };
      (jest.spyOn(WalletTransactionModel, 'findOne') as jest.Mock).mockReturnValue(withSession(existing));
      const walletFind = jest.spyOn(WalletModel, 'findByIdAndUpdate');

      const res = await service.debitWallet({ ownerPublicId: 'u1', amountCents: 2000, description: 'x', idempotencyKey: 'dup' } as never);

      expect(res).toMatchObject({ publicId: 'tx-existing' });
      expect(walletFind).not.toHaveBeenCalled(); // balance untouched
    });

    it('debits and records balanceAfter = before − amount', async () => {
      (jest.spyOn(WalletTransactionModel, 'findOne') as jest.Mock).mockReturnValue(withSession(null));
      (jest.spyOn(WalletModel, 'findOne') as jest.Mock).mockReturnValue(withSession({ _id: 'w1', publicId: 'wp1', balanceCents: 5000, isLocked: false }));
      jest.spyOn(WalletModel, 'findByIdAndUpdate').mockResolvedValue({} as never);
      const createSpy = (jest.spyOn(WalletTransactionModel, 'create') as jest.Mock).mockResolvedValue([{ toObject: () => ({ publicId: 'tx1' }) }]);

      await service.debitWallet({ ownerPublicId: 'u1', amountCents: 2000, description: 'x', idempotencyKey: 'k2' } as never);

      const txDoc = createSpy.mock.calls[0][0][0];
      expect(txDoc).toMatchObject({ balanceBeforeCents: 5000, balanceAfterCents: 3000, amountCents: 2000 });
    });

    it('rejects when wallet is locked', async () => {
      (jest.spyOn(WalletTransactionModel, 'findOne') as jest.Mock).mockReturnValue(withSession(null));
      (jest.spyOn(WalletModel, 'findOne') as jest.Mock).mockReturnValue(withSession({ _id: 'w1', publicId: 'wp1', balanceCents: 9999, isLocked: true, lockedReason: 'fraud' }));

      await expect(
        service.debitWallet({ ownerPublicId: 'u1', amountCents: 100, description: 'x', idempotencyKey: 'k3' } as never),
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe('creditWallet', () => {
    it('EARNED_CREDITS increments totalEarnedCents', async () => {
      (jest.spyOn(WalletTransactionModel, 'findOne') as jest.Mock).mockReturnValue(withSession(null));
      (jest.spyOn(WalletModel, 'findOne') as jest.Mock).mockReturnValue(withSession({ _id: 'w1', publicId: 'wp1', balanceCents: 0, isLocked: false }));
      const upd = jest.spyOn(WalletModel, 'findByIdAndUpdate').mockResolvedValue({} as never);
      (jest.spyOn(WalletTransactionModel, 'create') as jest.Mock).mockResolvedValue([{ toObject: () => ({ publicId: 'tx1' }) }]);

      await service.creditWallet({ ownerPublicId: 't1', amountCents: 1600, creditType: CreditType.EARNED_CREDITS, description: 'earn', idempotencyKey: 'e1' } as never);

      const incArg = (upd.mock.calls[0][1] as { $inc: Record<string, number> }).$inc;
      expect(incArg.balanceCents).toBe(1600);
      expect(incArg.totalEarnedCents).toBe(1600);
    });
  });
});
