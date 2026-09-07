import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import { walletController } from './wallet.controller';
import { payoutService } from './payout.service';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requirePermission, requireRole } from '../../middlewares/permission.middleware';
import { Permission } from '../../constants/permissions';
import { Role } from '../../constants/roles';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response';
import type { AuthRequest } from '../../shared/types';

const router = Router();
router.use(authMiddleware);

const actorFrom = (req: AuthRequest) => ({
  publicId: req.user!.publicId,
  role: req.user!.role,
  ip: req.ip,
  userAgent: req.get('user-agent'),
});

router.get('/me', requirePermission(Permission.VIEW_OWN_WALLET), walletController.getMyWallet.bind(walletController));
router.get('/me/transactions', requirePermission(Permission.VIEW_OWN_WALLET), walletController.getTransactionHistory.bind(walletController));

// ─── Payouts ────────────────────────────────────────────────────────────────
// Earners request; admins review. Requesting holds the funds immediately.

router.post('/me/payouts', requireRole(Role.TUTOR, Role.PRINCIPAL), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const payout = await payoutService.requestPayout(req.user!.publicId, req.body ?? {});
    sendCreated(res, payout, 'Payout requested');
  } catch (e) { next(e); }
});

router.get('/payouts', requirePermission(Permission.PROCESS_PAYOUT), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, ownerPublicId, ...pagination } = req.query as Record<string, string>;
    const result = await payoutService.listPayouts({ status, ownerPublicId }, pagination);
    sendPaginated(res, result, 'Payouts fetched');
  } catch (e) { next(e); }
});

router.post('/payouts/:publicId/approve', requirePermission(Permission.PROCESS_PAYOUT), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const updated = await payoutService.approvePayout(req.params.publicId, actorFrom(req), req.body?.note);
    sendSuccess(res, updated, 'Payout approved');
  } catch (e) { next(e); }
});

router.post('/payouts/:publicId/reject', requirePermission(Permission.PROCESS_PAYOUT), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const updated = await payoutService.rejectPayout(req.params.publicId, actorFrom(req), req.body?.reason);
    sendSuccess(res, updated, 'Payout rejected and funds returned');
  } catch (e) { next(e); }
});

// ─── Ledger explorer ────────────────────────────────────────────────────────

router.get('/transactions', requirePermission(Permission.VIEW_FINANCIAL_REPORTS), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { ownerPublicId, type, status, from, to, minCents, ...pagination } = req.query as Record<string, string>;
    const result = await payoutService.listTransactions(
      { ownerPublicId, type, status, from, to, minCents: minCents ? Number(minCents) : undefined },
      pagination,
    );
    sendPaginated(res, result, 'Transactions fetched');
  } catch (e) { next(e); }
});

router.get('/:userId', requireRole(Role.SUPER_ADMIN, Role.ADMIN), walletController.getWalletByUser.bind(walletController));

export default router;
