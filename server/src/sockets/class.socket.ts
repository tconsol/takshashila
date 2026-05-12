import { Server as IOServer } from 'socket.io';
import type { AuthSocket } from './socket.handler';
import { logger } from '../lib/logger';

export function registerClassSocket(io: IOServer, socket: AuthSocket): void {
  socket.on('class:join', (classPublicId: string) => {
    socket.join(`class:${classPublicId}`);
    socket.to(`class:${classPublicId}`).emit('class:user-joined', {
      userPublicId: socket.userPublicId,
      role: socket.userRole,
    });
    logger.info('User joined class room', { classPublicId, user: socket.userPublicId });
  });

  socket.on('class:leave', (classPublicId: string) => {
    socket.leave(`class:${classPublicId}`);
    socket.to(`class:${classPublicId}`).emit('class:user-left', {
      userPublicId: socket.userPublicId,
    });
  });

  socket.on('class:status-update', (payload: { classPublicId: string; status: string }) => {
    io.to(`class:${payload.classPublicId}`).emit('class:status-changed', {
      classPublicId: payload.classPublicId,
      status: payload.status,
      updatedBy: socket.userPublicId,
    });
  });

  socket.on('class:chat', (payload: { classPublicId: string; message: string }) => {
    io.to(`class:${payload.classPublicId}`).emit('class:chat-message', {
      from: socket.userPublicId,
      role: socket.userRole,
      message: payload.message,
      timestamp: new Date().toISOString(),
    });
  });

  socket.on('class:raise-hand', (classPublicId: string) => {
    socket.to(`class:${classPublicId}`).emit('class:hand-raised', {
      userPublicId: socket.userPublicId,
    });
  });
}
