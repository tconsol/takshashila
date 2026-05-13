import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../shared/types';
import { walletService } from './wallet.service';
import { sendSuccess, sendPaginated } from '../../utils/response';

export class WalletController {
  async getMyWallet(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const wallet = await walletService.getWallet(req.user!.publicId);
      sendSuccess(res, wallet, 'Wallet fetched');
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
