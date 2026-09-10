import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/auth.store';

let globalSocket: Socket | null = null;
/** The token the live socket was opened with, so a refresh reconnects once. */
let socketToken: string | null = null;

export function useSocket() {
  const { accessToken } = useAuthStore();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!accessToken) {
      if (globalSocket) {
        globalSocket.disconnect();
        globalSocket = null;
        socketToken = null;
        setConnected(false);
      }
      return;
    }

    /* Existence, not `.connected` — io() dials asynchronously, so every
       useSocket() caller mounting before the handshake lands would otherwise
       open its own socket and orphan the previous one. Socket.IO reconnects
       on its own, so a disconnected socket needs no replacement here. */
    if (!globalSocket || socketToken !== accessToken) {
      globalSocket?.disconnect();
      globalSocket = io(import.meta.env.VITE_API_URL?.replace('/api/v1', '') ?? 'http://localhost:4000', {
        auth: { token: accessToken },
        transports: ['websocket', 'polling'],
        autoConnect: true,
      });
      socketToken = accessToken;
    }

    const socket = globalSocket;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    if (socket.connected) setConnected(true);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [accessToken]);

  return { socket: globalSocket, connected };
}

export function getSocket(): Socket | null {
  return globalSocket;
}
