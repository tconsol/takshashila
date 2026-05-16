import { Server as IOServer } from 'socket.io';
import { domainEvents } from '../events/event-emitter';
import { DomainEvent } from '../constants/events';
import { StudentProfileModel } from '../modules/students/student.model';
import { TutorProfileModel } from '../modules/tutors/tutor.model';
import { PrincipalProfileModel } from '../modules/principals/principal.model';

function invalidate(io: IOServer, rooms: string[], module: string) {
  rooms.forEach((room) => io.to(room).emit('data:invalidate', { module }));
}

async function notifyTutorConnections(
  io: IOServer,
  tutorPublicId: string,
  module: string,
): Promise<void> {
  const [students, tutorProfile] = await Promise.all([
    StudentProfileModel.find({ tutorPublicId, isDeleted: false }, { userPublicId: 1 }).lean(),
    TutorProfileModel.findOne({ publicId: tutorPublicId, isDeleted: false }, { principalPublicId: 1, userPublicId: 1 }).lean(),
  ]);

  const rooms: string[] = students.map((s) => `user:${s.userPublicId}`);

  if (tutorProfile?.userPublicId) rooms.push(`user:${tutorProfile.userPublicId}`);

  if (tutorProfile?.principalPublicId) {
    const principal = await PrincipalProfileModel.findOne(
      { publicId: tutorProfile.principalPublicId, isDeleted: false },
      { userPublicId: 1 },
    ).lean();
    if (principal) rooms.push(`user:${principal.userPublicId}`);
  }

  if (rooms.length > 0) {
    invalidate(io, rooms, module);
    rooms.forEach((room) => io.to(room).emit('schedule:alert'));
  }
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
  domainEvents.on(DomainEvent.CLASS_STARTED, (payload: { classPublicId: string; tutorUserPublicId: string; studentUserPublicId?: string }) => {
    const rooms = [`user:${payload.tutorUserPublicId}`, 'role:PRINCIPAL'];
    if (payload.studentUserPublicId) rooms.push(`user:${payload.studentUserPublicId}`);
    invalidate(io, rooms, 'classes');
  });

  domainEvents.on(DomainEvent.CLASS_BOOKED, (payload: { tutorUserPublicId: string; studentUserPublicId: string }) => {
    invalidate(io, [
      `user:${payload.tutorUserPublicId}`,
      `user:${payload.studentUserPublicId}`,
      'role:PRINCIPAL',
      'role:ADMIN',
    ], 'classes');
  });

  domainEvents.on(DomainEvent.CLASS_CANCELLED, (payload: { tutorUserPublicId: string; studentUserPublicId: string }) => {
    invalidate(io, [
      `user:${payload.tutorUserPublicId}`,
      `user:${payload.studentUserPublicId}`,
      'role:PRINCIPAL',
    ], 'classes');
    invalidate(io, [
      `user:${payload.tutorUserPublicId}`,
      `user:${payload.studentUserPublicId}`,
    ], 'wallet');
  });

  domainEvents.on(DomainEvent.CLASS_CREATED_BY_TUTOR, (payload: {
    tutorUserPublicId: string;
    studentUserPublicIds: string[];
    title: string;
    classType: string;
    count: number;
  }) => {
    const studentRooms = payload.studentUserPublicIds.map((uid) => `user:${uid}`);
    invalidate(io, [...studentRooms, `user:${payload.tutorUserPublicId}`, 'role:PRINCIPAL'], 'classes');
    studentRooms.forEach((room) => {
      io.to(room).emit('class:created', {
        title: payload.title,
        classType: payload.classType,
        count: payload.count,
      });
    });
  });

  domainEvents.on(DomainEvent.CLASS_COMPLETED, (payload: { tutorUserPublicId: string; studentUserPublicId: string }) => {
    invalidate(io, [
      `user:${payload.tutorUserPublicId}`,
      `user:${payload.studentUserPublicId}`,
    ], 'classes');
    invalidate(io, [`user:${payload.tutorUserPublicId}`], 'wallet');
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

  // Student invited by tutor — notify the student so they see the pending invite
  domainEvents.on(DomainEvent.STUDENT_INVITED, (payload: { userPublicId: string; tutorUserPublicId: string }) => {
    invalidate(io, [`user:${payload.userPublicId}`], 'students');
    io.to(`user:${payload.userPublicId}`).emit('student:invited', { tutorUserPublicId: payload.tutorUserPublicId });
  });

  // Student approved — notify student, their tutor, and all principals
  domainEvents.on(DomainEvent.STUDENT_APPROVED, (payload: {
    studentPublicId: string;
    studentUserPublicId?: string;
    tutorUserPublicId?: string;
  }) => {
    const rooms: string[] = ['role:PRINCIPAL'];
    if (payload.studentUserPublicId) rooms.push(`user:${payload.studentUserPublicId}`);
    if (payload.tutorUserPublicId) rooms.push(`user:${payload.tutorUserPublicId}`);
    invalidate(io, rooms, 'students');
    // Also push tutors key so tutor's student list badge/count refreshes
    if (payload.tutorUserPublicId) invalidate(io, [`user:${payload.tutorUserPublicId}`], 'tutors');
  });

  // Slot events — notify connected students and principal
  domainEvents.on(DomainEvent.SLOT_CREATED, (payload: { tutorPublicId: string }) => {
    notifyTutorConnections(io, payload.tutorPublicId, 'schedules').catch(() => {});
  });

  domainEvents.on(DomainEvent.SLOT_CANCELLED, (payload: { tutorPublicId: string }) => {
    notifyTutorConnections(io, payload.tutorPublicId, 'schedules').catch(() => {});
  });

  domainEvents.on(DomainEvent.SLOT_RESCHEDULED, (payload: { tutorPublicId: string }) => {
    notifyTutorConnections(io, payload.tutorPublicId, 'schedules').catch(() => {});
  });

  // Demo request events
  domainEvents.on(DomainEvent.DEMO_REQUEST_CREATED, (payload: { tutorUserPublicId: string; studentUserPublicId: string; subject?: string }) => {
    invalidate(io, [`user:${payload.tutorUserPublicId}`], 'demo-requests');
    io.to(`user:${payload.tutorUserPublicId}`).emit('demo:new-request', { subject: payload.subject ?? '' });
  });

  domainEvents.on(DomainEvent.DEMO_REQUEST_ACCEPTED, (payload: { tutorUserPublicId: string; studentUserPublicId: string; classPublicId: string; subject: string }) => {
    invalidate(io, [`user:${payload.tutorUserPublicId}`, `user:${payload.studentUserPublicId}`], 'demo-requests');
    invalidate(io, [`user:${payload.studentUserPublicId}`, `user:${payload.tutorUserPublicId}`], 'classes');
    invalidate(io, [`user:${payload.tutorUserPublicId}`, `user:${payload.studentUserPublicId}`], 'badges');
    // Push real-time notification to student — will trigger toast + query update
    io.to(`user:${payload.studentUserPublicId}`).emit('demo:accepted', {
      classPublicId: payload.classPublicId,
      subject: payload.subject,
    });
  });

  domainEvents.on(DomainEvent.DEMO_REQUEST_REJECTED, (payload: { tutorUserPublicId: string; studentUserPublicId: string; subject: string }) => {
    invalidate(io, [`user:${payload.tutorUserPublicId}`, `user:${payload.studentUserPublicId}`], 'demo-requests');
    io.to(`user:${payload.studentUserPublicId}`).emit('demo:rejected', {
      subject: payload.subject,
    });
  });

  // Slot auto-expired → push schedule refresh to affected tutor
  domainEvents.on(DomainEvent.SLOT_EXPIRED, (payload: { tutorUserPublicId: string }) => {
    invalidate(io, [`user:${payload.tutorUserPublicId}`], 'schedules');
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
