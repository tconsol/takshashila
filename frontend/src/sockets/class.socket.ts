import { useEffect, useCallback } from 'react';
import { useSocket } from './use-socket';
import { SocketEvent } from './socket.events';
import type { ClassChatMessage, ClassStatusChangedPayload } from './socket.events';

export function useClassSocket(classPublicId: string | null, senderName?: string) {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket || !classPublicId) return;
    socket.emit(SocketEvent.CLASS_JOIN, classPublicId);
    return () => {
      socket.emit(SocketEvent.CLASS_LEAVE, classPublicId);
    };
  }, [socket, classPublicId]);

  const sendChatMessage = useCallback(
    (message: string) => {
      if (!socket || !classPublicId) return;
      socket.emit(SocketEvent.CLASS_CHAT, { classPublicId, message, senderName });
    },
    [socket, classPublicId, senderName],
  );

  const raiseHand = useCallback(() => {
    if (!socket || !classPublicId) return;
    socket.emit(SocketEvent.CLASS_RAISE_HAND, classPublicId);
  }, [socket, classPublicId]);

  const onChatMessage = useCallback(
    (handler: (msg: ClassChatMessage) => void) => {
      if (!socket) return () => {};
      socket.on(SocketEvent.CLASS_CHAT_MESSAGE, handler);
      return () => socket.off(SocketEvent.CLASS_CHAT_MESSAGE, handler);
    },
    [socket],
  );

  const onStatusChanged = useCallback(
    (handler: (payload: ClassStatusChangedPayload) => void) => {
      if (!socket) return () => {};
      socket.on(SocketEvent.CLASS_STATUS_CHANGED, handler);
      return () => socket.off(SocketEvent.CLASS_STATUS_CHANGED, handler);
    },
    [socket],
  );

  return { sendChatMessage, raiseHand, onChatMessage, onStatusChanged };
}
