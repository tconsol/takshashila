import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware';
import { chatService } from './chat.service';
import { getIO } from '../../sockets/socket.handler';
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
    // Push to all participants in the conversation room so other party sees message instantly
    try { getIO().to(`chat:${req.params.publicId}`).emit('chat:message', message); } catch {}
    res.status(201).json(message);
  } catch (e) { next(e); }
});

router.post('/conversations/:convId/messages/:messagePublicId/pin', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { durationHours } = req.body as { durationHours: number };
    const msg = await chatService.pinMessage(req.params.messagePublicId, req.user!.publicId, durationHours);
    try {
      getIO().to(`chat:${req.params.convId}`).emit('chat:message-pinned', { conversationPublicId: req.params.convId, message: msg });
    } catch {}
    res.json(msg);
  } catch (e) { next(e); }
});

router.delete('/conversations/:convId/messages/:messagePublicId/pin', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await chatService.unpinMessage(req.params.messagePublicId);
    try {
      getIO().to(`chat:${req.params.convId}`).emit('chat:message-unpinned', { conversationPublicId: req.params.convId, messagePublicId: req.params.messagePublicId });
    } catch {}
    res.json({ success: true });
  } catch (e) { next(e); }
});

router.post('/conversations/:convId/messages/:messagePublicId/react', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { emoji } = req.body as { emoji: string };
    const updatedMsg = await chatService.reactToMessage(req.params.messagePublicId, req.user!.publicId, emoji);
    try {
      getIO().to(`chat:${req.params.convId}`).emit('chat:reaction', {
        conversationPublicId: req.params.convId,
        message: updatedMsg,
      });
    } catch {}
    res.json(updatedMsg);
  } catch (e) { next(e); }
});

router.delete('/conversations/:convId/messages/:messagePublicId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const forEveryone = req.query.forEveryone === 'true';
    await chatService.deleteMessage(req.params.messagePublicId, req.user!.publicId, forEveryone);
    if (forEveryone) {
      try {
        getIO().to(`chat:${req.params.convId}`).emit('chat:message-deleted', {
          messagePublicId: req.params.messagePublicId,
          conversationPublicId: req.params.convId,
        });
      } catch {}
    }
    res.json({ success: true });
  } catch (e) { next(e); }
});

router.patch('/conversations/:publicId/read', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await chatService.markRead(req.params.publicId, req.user!.publicId);
    res.json({ success: true });
  } catch (e) { next(e); }
});

export { router as chatRouter };
