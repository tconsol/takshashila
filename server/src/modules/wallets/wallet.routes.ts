import { Router } from 'express';
import { walletController } from './wallet.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requirePermission, requireRole } from '../../middlewares/permission.middleware';
import { Permission } from '../../constants/permissions';
import { Role } from '../../constants/roles';

const router = Router();
router.use(authMiddleware);

router.get('/me', requirePermission(Permission.VIEW_OWN_WALLET), walletController.getMyWallet.bind(walletController));
router.get('/me/transactions', requirePermission(Permission.VIEW_OWN_WALLET), walletController.getTransactionHistory.bind(walletController));
router.get('/:userId', requireRole(Role.SUPER_ADMIN, Role.ADMIN), walletController.getWalletByUser.bind(walletController));

export default router;
