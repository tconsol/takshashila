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

  // ─── WebRTC signaling (dumb relay) ──────────────────────────────────────────

  socket.on('rtc:ready', (payload: { classPublicId: string }) => {
    socket.to(`class:${payload.classPublicId}`).emit('rtc:peer-joined', {
      socketId: socket.id,
      userPublicId: socket.userPublicId,
      role: socket.userRole,
    });
  });

  socket.on('rtc:offer', (payload: { to: string; offer: Record<string, unknown>; classPublicId: string }) => {
    io.to(payload.to).emit('rtc:offer', {
      from: socket.id,
      fromUserPublicId: socket.userPublicId,
      offer: payload.offer,
    });
  });

  socket.on('rtc:answer', (payload: { to: string; answer: Record<string, unknown> }) => {
    io.to(payload.to).emit('rtc:answer', {
      from: socket.id,
      answer: payload.answer,
    });
  });

  socket.on('rtc:ice-candidate', (payload: { to: string; candidate: Record<string, unknown> }) => {
    io.to(payload.to).emit('rtc:ice-candidate', {
      from: socket.id,
      candidate: payload.candidate,
    });
  });

  socket.on('rtc:leave', (classPublicId: string) => {
    socket.to(`class:${classPublicId}`).emit('rtc:peer-left', {
      socketId: socket.id,
      userPublicId: socket.userPublicId,
    });
  });

  // ─── Whiteboard sync ────────────────────────────────────────────────────────

  socket.on('wb:update', (payload: { classPublicId: string; elements: unknown[]; appState: unknown }) => {
    socket.to(`class:${payload.classPublicId}`).emit('wb:update', {
      elements: payload.elements,
      appState: payload.appState,
    });
  });

  // ─── Recording lifecycle ─────────────────────────────────────────────────────

  socket.on('recording:started', (classPublicId: string) => {
    socket.to(`class:${classPublicId}`).emit('recording:started', {
      startedBy: socket.userPublicId,
    });
  });

  socket.on('recording:stopped', (classPublicId: string) => {
    socket.to(`class:${classPublicId}`).emit('recording:stopped', {
      stoppedBy: socket.userPublicId,
    });
  });

  // Notify peers on unexpected disconnect
  socket.on('disconnect', () => {
    socket.rooms.forEach((room) => {
      if (room.startsWith('class:')) {
        socket.to(room).emit('rtc:peer-left', {
          socketId: socket.id,
          userPublicId: socket.userPublicId,
        });
      }
    });
  });
}
