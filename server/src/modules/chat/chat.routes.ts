import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware';
import { chatService } from './chat.service';
import type { AuthRequest } from '../../shared/types';

const router = Router();

router.use(requireAuth);

router.get('/conversations', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json(await chatService.getConversations(req.user!.publicId));
  } catch (e) { next(e); }
});

router.get('/conversations/unread-count', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const count = await chatService.getTotalUnread(req.user!.publicId);
    res.json({ count });
  } catch (e) { next(e); }
});

router.post('/conversations', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { recipientPublicId, recipientRole } = req.body as { recipientPublicId: string; recipientRole: string };
    const conversation = await chatService.getOrCreateConversation(
      req.user!.publicId,
      req.user!.role,
      recipientPublicId,
      recipientRole,
    );
    res.status(201).json(conversation);
  } catch (e) { next(e); }
});

router.get('/conversations/:publicId/messages', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json(
      await chatService.getMessages(req.params.publicId, req.user!.publicId, req.query as never),
    );
  } catch (e) { next(e); }
});

router.post('/conversations/:publicId/messages', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const message = await chatService.sendMessage(req.params.publicId, req.user!.publicId, req.body);
    res.status(201).json(message);
  } catch (e) { next(e); }
});

router.patch('/conversations/:publicId/read', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await chatService.markRead(req.params.publicId, req.user!.publicId);
    res.json({ success: true });
  } catch (e) { next(e); }
});

export { router as chatRouter };
