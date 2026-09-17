import { Server as IOServer } from 'socket.io';
import type { AuthSocket } from './socket.handler';
import { domainEvents } from '../events/event-emitter';
import { DomainEvent } from '../constants/events';

/**
 * Registered ONCE for the server, not per connection. The handler fans out to a
 * room, so one listener per socket meant a user with N sockets received N copies
 * of every notification.
 */
export function registerNotificationBridge(io: IOServer): void {
  domainEvents.on(
    DomainEvent.NOTIFICATION_SENT,
    (payload: { recipientPublicId: string; notificationPublicId: string; type: string }) => {
      io.to(`user:${payload.recipientPublicId}`).emit('notification:new', {
        notificationPublicId: payload.notificationPublicId,
        type: payload.type,
      });
    },
  );
}

export function registerNotificationSocket(_io: IOServer, socket: AuthSocket): void {
  socket.on('notification:mark-read', (notificationPublicId: string) => {
    socket.emit('notification:read-ack', { notificationPublicId });
  });
}

export function pushNotificationToUser(io: IOServer, recipientPublicId: string, data: unknown): void {
  io.to(`user:${recipientPublicId}`).emit('notification:new', data);
}
