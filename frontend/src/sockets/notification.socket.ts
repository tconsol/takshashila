import { useEffect } from 'react';
import { useSocket } from './use-socket';
import { SocketEvent } from './socket.events';
import type { NotificationNewPayload } from './socket.events';

export function useNotificationSocket(onNew: (payload: NotificationNewPayload) => void) {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;
    socket.on(SocketEvent.NOTIFICATION_NEW, onNew);
    return () => {
      socket.off(SocketEvent.NOTIFICATION_NEW, onNew);
    };
  }, [socket, onNew]);
}
