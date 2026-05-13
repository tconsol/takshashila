import { Server as HttpServer } from 'http';
import { Server as IOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { logger } from '../lib/logger';
import { env } from '../config/env';
import { registerClassSocket } from './class.socket';
import { registerNotificationSocket } from './notification.socket';
import { registerChatSocket } from './chat.socket';

export interface AuthSocket extends Socket {
  userPublicId: string;
  userRole: string;
}

let io: IOServer;

export function initSocketServer(httpServer: HttpServer): IOServer {
  io = new IOServer(httpServer, {
    cors: {
      origin: env.FRONTEND_URL,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token ?? socket.handshake.headers?.authorization?.split(' ')[1];
    if (!token) return next(new Error('Authentication required'));

    try {
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as { publicId: string; role: string };
      (socket as AuthSocket).userPublicId = payload.publicId;
      (socket as AuthSocket).userRole = payload.role;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const authSocket = socket as AuthSocket;
    logger.info('Socket connected', { socketId: socket.id, user: authSocket.userPublicId });

    socket.join(`user:${authSocket.userPublicId}`);

    registerClassSocket(io, authSocket);
    registerNotificationSocket(io, authSocket);
    registerChatSocket(io, authSocket);

    socket.on('disconnect', () => {
      logger.info('Socket disconnected', { socketId: socket.id });
    });
  });

  return io;
}

export function getIO(): IOServer {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}
