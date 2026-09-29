import { Server as IOServer } from 'socket.io';
import type { AuthSocket } from './socket.handler';
import { chatService } from '../modules/chat/chat.service';
import { userRepository } from '../modules/users/user.repository';
import { logger } from '../lib/logger';

export function registerChatSocket(io: IOServer, socket: AuthSocket): void {
  // Join all conversation rooms this user is part of
  chatService.getConversations(socket.userPublicId).then((convos) => {
    convos.forEach((c) => socket.join(`chat:${c.publicId}`));
  }).catch(() => {});

  socket.on('chat:send', async (payload: { conversationPublicId: string; body: string }) => {
    try {
      const message = await chatService.sendMessage(
        payload.conversationPublicId,
        socket.userPublicId,
        { body: payload.body },
      );
      // Emit to everyone in the conversation room (including sender for confirmation)
      io.to(`chat:${payload.conversationPublicId}`).emit('chat:message', message);
    } catch (e) {
      socket.emit('chat:error', { message: (e as Error).message });
      logger.error('chat:send error', { error: e });
    }
  });

  socket.on('chat:typing', async (conversationPublicId: string) => {
    try {
      const user = await userRepository.findByPublicId(socket.userPublicId);
      const displayName = user ? `${user.firstName} ${user.lastName}`.trim() : 'Someone';
      if (!socket.rooms.has(`chat:${conversationPublicId}`)) return; // only relay from joined (verified) rooms
      socket.to(`chat:${conversationPublicId}`).emit('chat:typing', {
        conversationPublicId,
        userPublicId: socket.userPublicId,
        displayName,
      });
    } catch {
      if (!socket.rooms.has(`chat:${conversationPublicId}`)) return;
      socket.to(`chat:${conversationPublicId}`).emit('chat:typing', {
        conversationPublicId,
        userPublicId: socket.userPublicId,
        displayName: 'Someone',
      });
    }
  });

  socket.on('chat:read', async (conversationPublicId: string) => {
    try {
      await chatService.markRead(conversationPublicId, socket.userPublicId);
      socket.to(`chat:${conversationPublicId}`).emit('chat:read-ack', {
        conversationPublicId,
        readerPublicId: socket.userPublicId,
      });
    } catch (e) {
      logger.error('chat:read error', { error: e });
    }
  });

  socket.on('chat:join', async (conversationPublicId: string, ack?: (res: { ok: boolean; error?: string }) => void) => {
    try {
      if (typeof conversationPublicId !== 'string' || !(await chatService.isParticipant(conversationPublicId, socket.userPublicId))) {
        if (typeof ack === 'function') ack({ ok: false, error: 'Conversation not found' });
        return;
      }
      socket.join(`chat:${conversationPublicId}`);
      if (typeof ack === 'function') ack({ ok: true });
    } catch (e) {
      logger.error('chat:join error', { error: e });
      if (typeof ack === 'function') ack({ ok: false, error: 'Could not join conversation' });
    }
  });
}
