/* wallet-admin.service is the guard layer in front of the already-tested
   credit/debit primitives (wallet.service.test.ts) — role eligibility, amount
   validation, the per-grant cap, and that every adjustment is audited. The
   underlying wallet mechanics are mocked out here on purpose. */
import { WalletAdminService } from '../../modules/wallets/wallet-admin.service';
import { walletService } from '../../modules/wallets/wallet.service';
import { userRepository } from '../../modules/users/user.repository';
import { auditService } from '../../modules/audit/audit.service';
import { Role } from '../../constants/roles';

jest.mock('../../modules/wallets/wallet.service', () => ({
  walletService: { creditWallet: jest.fn(), debitWallet: jest.fn() },
}));
jest.mock('../../modules/users/user.repository', () => ({
  userRepository: { findByPublicId: jest.fn() },
}));
jest.mock('../../modules/audit/audit.service', () => ({
  auditService: { log: jest.fn() },
}));

const actor = { publicId: 'admin-1', role: Role.SUPER_ADMIN, ip: '127.0.0.1', userAgent: 'test' };

const student = { publicId: 'stu-1', firstName: 'Ada', lastName: 'Lovelace', role: Role.STUDENT };

describe('WalletAdminService', () => {
  let service: WalletAdminService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WalletAdminService();
    (userRepository.findByPublicId as jest.Mock).mockResolvedValue(student);
    (walletService.creditWallet as jest.Mock).mockResolvedValue({ publicId: 'tx-1', amountCents: 5000 });
    (walletService.debitWallet as jest.Mock).mockResolvedValue({ publicId: 'tx-2', amountCents: 2000 });
  });

  describe('grant', () => {
    it('rejects a target the admin cannot find', async () => {
      (userRepository.findByPublicId as jest.Mock).mockResolvedValue(null);
      await expect(
        service.grant('missing', { amountCents: 100, creditType: 'BONUS_CREDITS', reason: 'x' } as never, actor),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it.each([Role.ADMIN, Role.SUPER_ADMIN, Role.SUPPORT, Role.PARENT])(
      'rejects a %s target — only student/tutor/principal wallets are adjustable',
      async (role) => {
        (userRepository.findByPublicId as jest.Mock).mockResolvedValue({ ...student, role });
        await expect(
          service.grant('t1', { amountCents: 100, creditType: 'BONUS_CREDITS', reason: 'x' } as never, actor),
        ).rejects.toMatchObject({ statusCode: 422 });
        expect(walletService.creditWallet).not.toHaveBeenCalled();
      },
    );

    it.each([Role.STUDENT, Role.TUTOR, Role.PRINCIPAL])('allows a %s target', async (role) => {
      (userRepository.findByPublicId as jest.Mock).mockResolvedValue({ ...student, role });
      await service.grant('t1', { amountCents: 100, creditType: 'BONUS_CREDITS', reason: 'ok' } as never, actor);
      expect(walletService.creditWallet).toHaveBeenCalled();
    });

    it('rejects a zero or negative amount', async () => {
      await expect(
        service.grant('stu-1', { amountCents: 0, creditType: 'BONUS_CREDITS', reason: 'x' } as never, actor),
      ).rejects.toMatchObject({ statusCode: 422 });
      await expect(
        service.grant('stu-1', { amountCents: -500, creditType: 'BONUS_CREDITS', reason: 'x' } as never, actor),
      ).rejects.toMatchObject({ statusCode: 422 });
    });

    it('rejects an amount above the single-grant cap', async () => {
      await expect(
        service.grant('stu-1', { amountCents: 100_001_00, creditType: 'BONUS_CREDITS', reason: 'x' } as never, actor),
      ).rejects.toMatchObject({ statusCode: 422 });
    });

    it('allows the amount exactly at the cap', async () => {
      await service.grant('stu-1', { amountCents: 100_000_00, creditType: 'BONUS_CREDITS', reason: 'ok' } as never, actor);
      expect(walletService.creditWallet).toHaveBeenCalled();
    });

    it('rejects an unknown credit type', async () => {
      await expect(
        service.grant('stu-1', { amountCents: 100, creditType: 'NOT_REAL', reason: 'x' } as never, actor),
      ).rejects.toMatchObject({ statusCode: 422 });
    });

    it('rejects a blank or missing reason', async () => {
      await expect(
        service.grant('stu-1', { amountCents: 100, creditType: 'BONUS_CREDITS', reason: '   ' } as never, actor),
      ).rejects.toMatchObject({ statusCode: 422 });
      await expect(
        service.grant('stu-1', { amountCents: 100, creditType: 'BONUS_CREDITS' } as never, actor),
      ).rejects.toMatchObject({ statusCode: 422 });
    });

    it('passes the exact amount, type and description through, and logs an audit entry', async () => {
      await service.grant(
        'stu-1',
        { amountCents: 2599, creditType: 'PURCHASED_CREDITS', reason: 'Refund goodwill' } as never,
        actor,
      );

      expect(walletService.creditWallet).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerPublicId: 'stu-1',
          amountCents: 2599,
          creditType: 'PURCHASED_CREDITS',
          description: expect.stringContaining('Refund goodwill'),
        }),
      );

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: actor.publicId,
          action: 'WALLET_CREDIT_GRANTED',
          resourceType: 'Wallet',
          resourceId: 'stu-1',
        }),
      );
    });

    it('gives each grant its own idempotency key so repeat grants are not collapsed', async () => {
      await service.grant('stu-1', { amountCents: 100, creditType: 'BONUS_CREDITS', reason: 'first' } as never, actor);
      await service.grant('stu-1', { amountCents: 100, creditType: 'BONUS_CREDITS', reason: 'second' } as never, actor);

      const calls = (walletService.creditWallet as jest.Mock).mock.calls;
      expect(calls[0][0].idempotencyKey).not.toBe(calls[1][0].idempotencyKey);
    });
  });

  describe('deduct', () => {
    it('rejects a non-adjustable role', async () => {
      (userRepository.findByPublicId as jest.Mock).mockResolvedValue({ ...student, role: Role.ADMIN });
      await expect(
        service.deduct('t1', { amountCents: 100, reason: 'x' } as never, actor),
      ).rejects.toMatchObject({ statusCode: 422 });
    });

    it('rejects a non-positive amount', async () => {
      await expect(
        service.deduct('stu-1', { amountCents: 0, reason: 'x' } as never, actor),
      ).rejects.toMatchObject({ statusCode: 422 });
    });

    it('rejects a blank reason', async () => {
      await expect(
        service.deduct('stu-1', { amountCents: 100, reason: '' } as never, actor),
      ).rejects.toMatchObject({ statusCode: 422 });
    });

    it('calls debitWallet and logs an audit entry on success', async () => {
      await service.deduct('stu-1', { amountCents: 500, reason: 'Correcting over-grant' } as never, actor);

      expect(walletService.debitWallet).toHaveBeenCalledWith(
        expect.objectContaining({ ownerPublicId: 'stu-1', amountCents: 500 }),
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'WALLET_CREDIT_DEDUCTED', resourceId: 'stu-1' }),
      );
    });

    it('propagates an insufficient-balance rejection from debitWallet unchanged', async () => {
      (walletService.debitWallet as jest.Mock).mockRejectedValue(
        Object.assign(new Error('Insufficient credits'), { statusCode: 402 }),
      );
      await expect(
        service.deduct('stu-1', { amountCents: 999999, reason: 'x' } as never, actor),
      ).rejects.toMatchObject({ statusCode: 402 });
    });
  });
});
