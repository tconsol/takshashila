import { Server as IOServer } from 'socket.io';
import type { AuthSocket } from './socket.handler';
import { logger } from '../lib/logger';
import { getClassMembership, getClassRoomKey, type ClassMembership } from './class-membership';

type Ack = (res: { ok: boolean; error?: string }) => void;

export function registerClassSocket(io: IOServer, socket: AuthSocket): void {
  // Classes this socket has been verified for (populated only by class:join).
  const memberships = new Map<string, Exclude<ClassMembership, null>>();
  // The room each joined class uses: the records of one group session share a room.
  const roomKeys = new Map<string, string>();
  const room = (classPublicId: string) => `class:${roomKeys.get(classPublicId) ?? classPublicId}`;

  /** Member of the class room: tutor, student or watch-only observer. */
  const isMember = (classPublicId: unknown): classPublicId is string =>
    typeof classPublicId === 'string' && memberships.has(classPublicId) && socket.rooms.has(room(classPublicId));

  /** Only the tutor and the student may relay whiteboard/signalling/presence that affects others. */
  const isParticipant = (classPublicId: unknown): classPublicId is string => {
    if (!isMember(classPublicId)) return false;
    const m = memberships.get(classPublicId);
    return m === 'tutor' || m === 'student';
  };

  /** Target socket must sit in a class room where the sender is a participant. */
  const canSignalTo = (to: unknown): to is string => {
    if (typeof to !== 'string') return false;
    for (const classPublicId of memberships.keys()) {
      if (!isParticipant(classPublicId)) continue;
      if (io.sockets.adapter.rooms.get(room(classPublicId))?.has(to)) return true;
    }
    return false;
  };

  socket.on('class:join', async (classPublicId: string, ack?: Ack) => {
    try {
      const membership = await getClassMembership(
        { publicId: socket.userPublicId, role: socket.userRole },
        classPublicId,
      );
      if (!membership) {
        if (typeof ack === 'function') ack({ ok: false, error: 'Scheduled class not found' });
        return;
      }
      memberships.set(classPublicId, membership);
      roomKeys.set(classPublicId, await getClassRoomKey(classPublicId));
    } catch (e) {
      logger.error('class:join membership check failed', { error: e });
      if (typeof ack === 'function') ack({ ok: false, error: 'Could not join class' });
      return;
    }
    socket.join(room(classPublicId));
    if (typeof ack === 'function') ack({ ok: true });
    socket.to(room(classPublicId)).emit('class:user-joined', {
      userPublicId: socket.userPublicId,
      role: socket.userRole,
    });
    logger.info('User joined class room', { classPublicId, user: socket.userPublicId });
  });

  socket.on('class:leave', (classPublicId: string) => {
    if (!isMember(classPublicId)) return;
    memberships.delete(classPublicId);
    socket.leave(room(classPublicId));
    socket.to(room(classPublicId)).emit('class:user-left', {
      userPublicId: socket.userPublicId,
    });
    roomKeys.delete(classPublicId);
  });

  socket.on('class:status-update', (payload: { classPublicId: string; status: string }) => {
    if (!isParticipant(payload?.classPublicId)) return;
    io.to(room(payload.classPublicId)).emit('class:status-changed', {
      classPublicId: payload.classPublicId,
      status: payload.status,
      updatedBy: socket.userPublicId,
    });
  });

  socket.on('class:chat', (payload: { classPublicId: string; message: string; senderName?: string }) => {
    if (!isMember(payload?.classPublicId)) return;
    io.to(room(payload.classPublicId)).emit('class:chat-message', {
      from: socket.userPublicId,
      role: socket.userRole,
      name: payload.senderName ?? '',
      message: payload.message,
      timestamp: new Date().toISOString(),
    });
  });

  socket.on('class:raise-hand', (classPublicId: string) => {
    if (!isMember(classPublicId)) return;
    socket.to(room(classPublicId)).emit('class:hand-raised', {
      userPublicId: socket.userPublicId,
    });
  });

  // ─── Participant name announcements (Agora UID → display name) ──────────────

  socket.on('class:announce', (payload: { classPublicId: string; agoraUid: number; name: string; role: string }) => {
    if (!isParticipant(payload?.classPublicId)) return;
    socket.to(room(payload.classPublicId)).emit('class:announce', {
      agoraUid: payload.agoraUid,
      name: payload.name,
      role: payload.role,
    });
  });

  // ─── WebRTC signaling (relay, restricted to tutor/student of the class) ─────

  socket.on('rtc:ready', (payload: { classPublicId: string }) => {
    if (!isParticipant(payload?.classPublicId)) return;
    socket.to(room(payload.classPublicId)).emit('rtc:peer-joined', {
      socketId: socket.id,
      userPublicId: socket.userPublicId,
      role: socket.userRole,
    });
  });

  socket.on('rtc:offer', (payload: { to: string; offer: Record<string, unknown>; classPublicId: string }) => {
    if (!isParticipant(payload?.classPublicId) || !canSignalTo(payload.to)) return;
    io.to(payload.to).emit('rtc:offer', {
      from: socket.id,
      fromUserPublicId: socket.userPublicId,
      offer: payload.offer,
    });
  });

  socket.on('rtc:answer', (payload: { to: string; answer: Record<string, unknown> }) => {
    if (!canSignalTo(payload?.to)) return;
    io.to(payload.to).emit('rtc:answer', {
      from: socket.id,
      answer: payload.answer,
    });
  });

  socket.on('rtc:ice-candidate', (payload: { to: string; candidate: Record<string, unknown> }) => {
    if (!canSignalTo(payload?.to)) return;
    io.to(payload.to).emit('rtc:ice-candidate', {
      from: socket.id,
      candidate: payload.candidate,
    });
  });

  socket.on('rtc:leave', (classPublicId: string) => {
    if (!isMember(classPublicId)) return;
    socket.to(room(classPublicId)).emit('rtc:peer-left', {
      socketId: socket.id,
      userPublicId: socket.userPublicId,
    });
  });

  // ─── Screen share signaling ─────────────────────────────────────────────────

  socket.on('class:screen-share', (payload: { classPublicId: string; agoraUid: number; active: boolean }) => {
    if (!isParticipant(payload?.classPublicId)) return;
    socket.to(room(payload.classPublicId)).emit('class:screen-share', {
      agoraUid: payload.agoraUid,
      active: payload.active,
    });
  });

  // ─── Whiteboard sync ────────────────────────────────────────────────────────

  socket.on('wb:update', (payload: { classPublicId: string; elements: unknown[]; appState: unknown }) => {
    if (!isParticipant(payload?.classPublicId)) return;
    socket.to(room(payload.classPublicId)).emit('wb:update', {
      elements: payload.elements,
      appState: payload.appState,
    });
  });

  // Notify peers on unexpected disconnect
  socket.on('disconnect', () => {
    socket.rooms.forEach((r) => {
      if (r.startsWith('class:')) {
        socket.to(r).emit('rtc:peer-left', {
          socketId: socket.id,
          userPublicId: socket.userPublicId,
        });
      }
    });
  });
}
