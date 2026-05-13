import { Server as IOServer } from 'socket.io';
import type { AuthSocket } from './socket.handler';
import { domainEvents } from '../events/event-emitter';
import { DomainEvent } from '../constants/events';

export function registerNotificationSocket(io: IOServer, socket: AuthSocket): void {
  const onNotificationSent = (payload: { recipientPublicId: string; notificationPublicId: string; type: string }) => {
    if (payload.recipientPublicId === socket.userPublicId) {
      io.to(`user:${payload.recipientPublicId}`).emit('notification:new', {
        notificationPublicId: payload.notificationPublicId,
        type: payload.type,
      });
    }
  };

  domainEvents.on(DomainEvent.NOTIFICATION_SENT, onNotificationSent);

  socket.on('notification:mark-read', (notificationPublicId: string) => {
    socket.emit('notification:read-ack', { notificationPublicId });
  });

  socket.on('disconnect', () => {
    domainEvents.off(DomainEvent.NOTIFICATION_SENT, onNotificationSent);
  });
}

export function pushNotificationToUser(io: IOServer, recipientPublicId: string, data: unknown): void {
  io.to(`user:${recipientPublicId}`).emit('notification:new', data);
}
