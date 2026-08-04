import { io, type Socket } from 'socket.io-client';
import { tokenStorage } from './token';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:3000/api/v1';
const SOCKET_URL = API_BASE.replace(/\/api\/v\d+\/?$/, '');

let socket: Socket | null = null;

export async function connectSocket(): Promise<Socket | null> {
  const token = await tokenStorage.getAccessToken();
  if (!token) return null;
  if (socket?.connected) return socket;
  if (socket) { socket.disconnect(); socket = null; }

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
  });
  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
