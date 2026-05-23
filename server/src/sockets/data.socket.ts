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
    const rooms = [`user:${payload.tutorUserPublicId}`, `user:${payload.studentUserPublicId}`];
    invalidate(io, [...rooms, 'role:PRINCIPAL', 'role:ADMIN'], 'classes');
    rooms.forEach((r) => io.to(r).emit('schedule:alert'));
  });

  domainEvents.on(DomainEvent.CLASS_CANCELLED, (payload: { tutorUserPublicId: string; studentUserPublicId: string }) => {
    const rooms = [`user:${payload.tutorUserPublicId}`, `user:${payload.studentUserPublicId}`];
    invalidate(io, [...rooms, 'role:PRINCIPAL'], 'classes');
    invalidate(io, rooms, 'wallet');
    rooms.forEach((r) => io.to(r).emit('schedule:alert'));
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
      // Light up the Classes sidebar badge for each student
      io.to(room).emit('schedule:alert');
    });
  });

  domainEvents.on(DomainEvent.CLASS_COMPLETED, (payload: { tutorUserPublicId: string; studentUserPublicId: string }) => {
    const rooms = [`user:${payload.tutorUserPublicId}`, `user:${payload.studentUserPublicId}`];
    invalidate(io, rooms, 'classes');
    invalidate(io, [`user:${payload.tutorUserPublicId}`], 'wallet');
    // Refresh student profile so demo count and stats update
    if (payload.studentUserPublicId) invalidate(io, [`user:${payload.studentUserPublicId}`], 'students');
    // Refresh tutor stats
    invalidate(io, [`user:${payload.tutorUserPublicId}`], 'tutors');
  });

  domainEvents.on(DomainEvent.CLASS_RESCHEDULED, (payload: { tutorUserPublicId: string; studentUserPublicId: string }) => {
    const rooms = [`user:${payload.tutorUserPublicId}`, `user:${payload.studentUserPublicId}`];
    invalidate(io, rooms, 'classes');
    rooms.forEach((r) => io.to(r).emit('schedule:alert'));
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
    // Refresh student profile so attendanceRate stat updates everywhere
    invalidate(io, [`user:${payload.studentPublicId}`], 'students');
  });

  domainEvents.on(DomainEvent.ATTENDANCE_OVERRIDDEN, (payload: { studentPublicId: string }) => {
    invalidate(io, [`user:${payload.studentPublicId}`, 'role:TUTOR', 'role:PRINCIPAL'], 'attendance');
    invalidate(io, [`user:${payload.studentPublicId}`], 'students');
  });

  // Wallet / payments — wallet.service emits ownerPublicId, not userId
  domainEvents.on(DomainEvent.CREDITS_ADDED, (payload: { ownerPublicId: string }) => {
    invalidate(io, [`user:${payload.ownerPublicId}`], 'wallet');
  });

  domainEvents.on(DomainEvent.CREDITS_DEDUCTED, (payload: { ownerPublicId: string }) => {
    invalidate(io, [`user:${payload.ownerPublicId}`], 'wallet');
  });

  domainEvents.on(DomainEvent.CREDITS_REFUNDED, (payload: { ownerPublicId: string }) => {
    invalidate(io, [`user:${payload.ownerPublicId}`], 'wallet');
  });

  // Payment received → wallet already refreshed by CREDITS_ADDED but invalidate transactions too
  domainEvents.on(DomainEvent.PAYMENT_RECEIVED, (payload: { userPublicId: string }) => {
    invalidate(io, [`user:${payload.userPublicId}`], 'wallet');
  });

  // Support tickets
  domainEvents.on(DomainEvent.TICKET_CREATED, () => {
    invalidate(io, ['role:SUPPORT', 'role:ADMIN', 'role:SUPER_ADMIN'], 'tickets');
  });

  domainEvents.on(DomainEvent.TICKET_RESOLVED, () => {
    invalidate(io, ['role:SUPPORT', 'role:ADMIN', 'role:SUPER_ADMIN'], 'tickets');
  });

  // Student invited by tutor — notify the student so they see the pending invite
  domainEvents.on(DomainEvent.STUDENT_INVITED, (payload: { userPublicId: string; tutorUserPublicId?: string }) => {
    invalidate(io, [`user:${payload.userPublicId}`], 'students');
    if (payload.tutorUserPublicId) {
      io.to(`user:${payload.userPublicId}`).emit('student:invited', { tutorUserPublicId: payload.tutorUserPublicId });
    }
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

  // Tutor approved by admin → notify the tutor, refresh admin/principal views
  domainEvents.on(DomainEvent.TUTOR_APPROVED, (payload: { tutorPublicId: string; userPublicId?: string }) => {
    if (payload.userPublicId) invalidate(io, [`user:${payload.userPublicId}`], 'tutors');
    invalidate(io, ['role:ADMIN', 'role:SUPER_ADMIN', 'role:PRINCIPAL'], 'tutors');
  });

  domainEvents.on(DomainEvent.TUTOR_SUSPENDED, (payload: { tutorPublicId: string; userPublicId?: string }) => {
    if (payload.userPublicId) invalidate(io, [`user:${payload.userPublicId}`], 'tutors');
    invalidate(io, ['role:ADMIN', 'role:SUPER_ADMIN', 'role:PRINCIPAL'], 'tutors');
  });

  // Tutor rated → refresh tutor profile so rating/count updates in UI
  domainEvents.on(DomainEvent.TUTOR_RATED, (payload: { tutorPublicId: string }) => {
    TutorProfileModel.findOne({ publicId: payload.tutorPublicId, isDeleted: false }, { userPublicId: 1 })
      .lean()
      .then((tutor) => {
        if (tutor?.userPublicId) invalidate(io, [`user:${tutor.userPublicId}`, 'role:PRINCIPAL', 'role:ADMIN'], 'tutors');
      })
      .catch(() => {});
  });

  // Student transferred between tutors → refresh old tutor, new tutor, student, principal
  domainEvents.on(DomainEvent.STUDENT_TRANSFERRED, (payload: { studentPublicId: string; fromTutor: string; toTutor: string }) => {
    Promise.all([
      StudentProfileModel.findOne({ publicId: payload.studentPublicId, isDeleted: false }, { userPublicId: 1 }).lean(),
      TutorProfileModel.findOne({ publicId: payload.fromTutor, isDeleted: false }, { userPublicId: 1 }).lean(),
      TutorProfileModel.findOne({ publicId: payload.toTutor, isDeleted: false }, { userPublicId: 1 }).lean(),
    ]).then(([student, fromTutor, toTutor]) => {
      const rooms: string[] = ['role:PRINCIPAL'];
      if (student?.userPublicId) rooms.push(`user:${student.userPublicId}`);
      if (fromTutor?.userPublicId) rooms.push(`user:${fromTutor.userPublicId}`);
      if (toTutor?.userPublicId) rooms.push(`user:${toTutor.userPublicId}`);
      invalidate(io, rooms, 'students');
      if (fromTutor?.userPublicId) invalidate(io, [`user:${fromTutor.userPublicId}`], 'tutors');
      if (toTutor?.userPublicId) invalidate(io, [`user:${toTutor.userPublicId}`], 'tutors');
    }).catch(() => {});
  });

  domainEvents.on(DomainEvent.STUDENT_INACTIVATED, (payload: { studentPublicId: string; studentUserPublicId?: string }) => {
    const rooms: string[] = ['role:PRINCIPAL', 'role:TUTOR'];
    if (payload.studentUserPublicId) rooms.push(`user:${payload.studentUserPublicId}`);
    invalidate(io, rooms, 'students');
  });

  // Ticket escalated → same audience as created/resolved
  domainEvents.on(DomainEvent.TICKET_ESCALATED, () => {
    invalidate(io, ['role:SUPPORT', 'role:ADMIN', 'role:SUPER_ADMIN'], 'tickets');
  });

  // Principal approved/suspended → also notify the principal themselves
  domainEvents.on(DomainEvent.PRINCIPAL_APPROVED, (payload: { principalPublicId: string; userPublicId: string }) => {
    if (payload.userPublicId) invalidate(io, [`user:${payload.userPublicId}`], 'principals');
    invalidate(io, ['role:ADMIN', 'role:SUPER_ADMIN'], 'principals');
  });
}
