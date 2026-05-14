import { useState, useEffect, useRef, useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import { SocketEvent } from '../sockets/socket.events';
import type { WbUpdatePayload } from '../sockets/socket.events';

export function useWhiteboardSync(classPublicId: string | null, socket: Socket | null) {
  const [remoteElements, setRemoteElements] = useState<unknown[]>([]);
  const throttleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!socket) return;
    const handler = ({ elements }: WbUpdatePayload) => {
      setRemoteElements(elements);
    };
    socket.on(SocketEvent.WB_UPDATE, handler);
    return () => { socket.off(SocketEvent.WB_UPDATE, handler); };
  }, [socket]);

  const broadcastUpdate = useCallback(
    (elements: unknown[], appState: unknown) => {
      if (!socket || !classPublicId || throttleRef.current) return;
      throttleRef.current = setTimeout(() => {
        socket.emit(SocketEvent.WB_UPDATE, { classPublicId, elements, appState });
        throttleRef.current = null;
      }, 80);
    },
    [socket, classPublicId],
  );

  return { remoteElements, broadcastUpdate };
}
