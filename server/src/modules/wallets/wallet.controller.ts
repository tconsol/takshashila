import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../shared/types';
import { walletService } from './wallet.service';
import { getEarningsOnHoldCents, getWithdrawableCents, EARNINGS_HOLD_HOURS } from './payout.service';
import { reserveService } from './reserve.service';
import { sendSuccess, sendPaginated } from '../../utils/response';

export class WalletController {
  async getMyWallet(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const wallet = await walletService.getWallet(req.user!.publicId);
      // Normalize field names + add computed aliases for frontend compatibility
      const withdrawableCents = await getWithdrawableCents(req.user!.publicId, wallet);
      const onHoldCents = await getEarningsOnHoldCents(req.user!.publicId);
      const hold = await reserveService.getHoldForUser(req.user!.publicId, wallet);
      const response = {
        ...wallet,
        spendableCents: hold.spendableCents,
        reservedCents: hold.reservedCents,
        availableCents: hold.availableCents,
        withdrawableCents,
        earningsOnHoldCents: onHoldCents,
        earningsHoldHours: EARNINGS_HOLD_HOURS,
        purchasedCreditsCents: wallet.purchasedCreditsCents ?? 0,
        earnedCreditsCents: wallet.earnedCreditsCents ?? 0,
        earningsCents: wallet.earnedCreditsCents ?? 0,
      };
      sendSuccess(res, response, 'Wallet fetched');
    } catch (error) {
      next(error);
    }
  }

  async getTransactionHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await walletService.getTransactionHistory(req.user!.publicId, req.query);
      sendPaginated(res, result, 'Transaction history fetched');
    } catch (error) {
      next(error);
    }
  }

  async getWalletByUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const wallet = await walletService.getWallet(req.params.userId);
      sendSuccess(res, wallet, 'Wallet fetched');
    } catch (error) {
      next(error);
    }
  }
}

export const walletController = new WalletController();
