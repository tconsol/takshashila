import { Server as IOServer } from 'socket.io';
import { domainEvents } from '../events/event-emitter';
import { DomainEvent } from '../constants/events';

function invalidate(io: IOServer, rooms: string[], module: string) {
  rooms.forEach((room) => io.to(room).emit('data:invalidate', { module }));
}

export function registerDataInvalidationSocket(io: IOServer): void {
  // Principals changed → admins & super-admins need fresh data
  domainEvents.on(DomainEvent.PRINCIPAL_APPROVED, () => {
    invalidate(io, ['role:ADMIN', 'role:SUPER_ADMIN'], 'principals');
  });

  domainEvents.on(DomainEvent.PRINCIPAL_SUSPENDED, () => {
    invalidate(io, ['role:ADMIN', 'role:SUPER_ADMIN'], 'principals');
  });

  // New user registered → admin overview counts change
  domainEvents.on(DomainEvent.USER_REGISTERED, () => {
    invalidate(io, ['role:ADMIN', 'role:SUPER_ADMIN'], 'users');
  });

  // Class events → tutors, students, principals, admins
  domainEvents.on(DomainEvent.CLASS_BOOKED, (payload: { studentPublicId: string; tutorPublicId: string }) => {
    invalidate(io, [
      `user:${payload.studentPublicId}`,
      `user:${payload.tutorPublicId}`,
      'role:PRINCIPAL',
      'role:ADMIN',
    ], 'classes');
  });

  domainEvents.on(DomainEvent.CLASS_CANCELLED, (payload: { studentPublicId: string; tutorPublicId: string }) => {
    invalidate(io, [
      `user:${payload.studentPublicId}`,
      `user:${payload.tutorPublicId}`,
      'role:PRINCIPAL',
    ], 'classes');
  });

  domainEvents.on(DomainEvent.CLASS_COMPLETED, (payload: { studentPublicId: string; tutorPublicId: string }) => {
    invalidate(io, [
      `user:${payload.studentPublicId}`,
      `user:${payload.tutorPublicId}`,
    ], 'classes');
  });

  // Assignment events
  domainEvents.on(DomainEvent.ASSIGNMENT_SUBMITTED, (payload: { studentPublicId: string }) => {
    invalidate(io, [`user:${payload.studentPublicId}`, 'role:TUTOR'], 'assignments');
  });

  domainEvents.on(DomainEvent.ASSIGNMENT_GRADED, (payload: { studentPublicId: string }) => {
    invalidate(io, [`user:${payload.studentPublicId}`], 'assignments');
  });

  // Attendance
  domainEvents.on(DomainEvent.ATTENDANCE_MARKED, (payload: { studentPublicId: string }) => {
    invalidate(io, [`user:${payload.studentPublicId}`, 'role:TUTOR', 'role:PRINCIPAL'], 'attendance');
  });

  // Wallet / payments
  domainEvents.on(DomainEvent.CREDITS_ADDED, (payload: { userId: string }) => {
    invalidate(io, [`user:${payload.userId}`], 'wallet');
  });

  domainEvents.on(DomainEvent.CREDITS_DEDUCTED, (payload: { userId: string }) => {
    invalidate(io, [`user:${payload.userId}`], 'wallet');
  });

  domainEvents.on(DomainEvent.CREDITS_REFUNDED, (payload: { userId: string }) => {
    invalidate(io, [`user:${payload.userId}`], 'wallet');
  });

  // Support tickets
  domainEvents.on(DomainEvent.TICKET_CREATED, () => {
    invalidate(io, ['role:SUPPORT', 'role:ADMIN', 'role:SUPER_ADMIN'], 'tickets');
  });

  domainEvents.on(DomainEvent.TICKET_RESOLVED, () => {
    invalidate(io, ['role:SUPPORT', 'role:ADMIN', 'role:SUPER_ADMIN'], 'tickets');
  });

  // Student approved
  domainEvents.on(DomainEvent.STUDENT_APPROVED, (payload: { studentPublicId: string }) => {
    invalidate(io, [`user:${payload.studentPublicId}`, 'role:PRINCIPAL', 'role:TUTOR'], 'students');
  });

  // Join requests
  domainEvents.on(DomainEvent.JOIN_REQUEST_SENT, (payload: { tutorUserPublicId: string; principalUserPublicId: string }) => {
    invalidate(io, [`user:${payload.tutorUserPublicId}`, `user:${payload.principalUserPublicId}`], 'join-requests');
  });

  domainEvents.on(DomainEvent.JOIN_REQUEST_APPROVED, (payload: { tutorUserPublicId: string; principalUserPublicId: string }) => {
    invalidate(io, [`user:${payload.tutorUserPublicId}`, `user:${payload.principalUserPublicId}`, 'role:ADMIN'], 'join-requests');
    invalidate(io, [`user:${payload.principalUserPublicId}`], 'tutors');
  });

  domainEvents.on(DomainEvent.JOIN_REQUEST_REJECTED, (payload: { tutorUserPublicId: string; principalUserPublicId: string }) => {
    invalidate(io, [`user:${payload.tutorUserPublicId}`, `user:${payload.principalUserPublicId}`], 'join-requests');
  });
}
