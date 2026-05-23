import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware';
import { paymentService } from './payment.service';
import type { AuthRequest } from '../../shared/types';

const router = Router();

router.get('/config', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json(await paymentService.getClientConfig());
  } catch (e) { next(e); }
});

router.post('/stripe/webhook', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sig = req.headers['stripe-signature'] as string;
    await paymentService.handleStripeWebhook(req.body as Buffer, sig);
    res.json({ received: true });
  } catch (e) { next(e); }
});

router.use(requireAuth);

router.post('/order', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const payment = await paymentService.createOrder(req.user!.publicId, req.body);
    res.status(201).json(payment);
  } catch (e) { next(e); }
});

router.post('/verify', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const payment = await paymentService.verifyAndCredit(req.user!.publicId, req.body);
    res.json(payment);
  } catch (e) { next(e); }
});

router.get('/history', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json(await paymentService.getHistory(req.user!.publicId));
  } catch (e) { next(e); }
});

export { router as paymentRouter };
