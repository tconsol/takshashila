import { EventEmitter } from 'events';
import { registerClassSocket } from '../../sockets/class.socket';
import { registerChatSocket } from '../../sockets/chat.socket';
import * as membership from '../../sockets/class-membership';
import { chatService } from '../../modules/chat/chat.service';
import { ScheduledClassModel } from '../../modules/schedules/schedule.model';
import { TutorProfileModel } from '../../modules/tutors/tutor.model';
import { StudentProfileModel } from '../../modules/students/student.model';
import { ParentProfileModel } from '../../modules/parents/parent.model';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });
const tick = () => new Promise((r) => setImmediate(r));

function fakeSocket(userPublicId: string, userRole: string) {
  const em = new EventEmitter();
  const rooms = new Set<string>();
  const relayed: Array<{ room: string; event: string }> = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const socket: any = {
    id: `sock-${userPublicId}`, userPublicId, userRole, rooms,
    on: (e: string, h: (...a: unknown[]) => unknown) => em.on(e, h),
    join: (r: string) => { rooms.add(r); },
    leave: (r: string) => { rooms.delete(r); },
    emit: jest.fn(),
    to: (r: string) => ({ emit: (event: string) => relayed.push({ room: r, event }) }),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const io: any = { to: () => ({ emit: jest.fn() }), sockets: { adapter: { rooms: new Map() } } };
  const fire = async (e: string, ...a: unknown[]) => { em.emit(e, ...a); await tick(); await tick(); };
  return { socket, io, relayed, fire };
}

describe('getClassMembership', () => {
  const cls = { tutorPublicId: 't-1', studentPublicId: 's-1' };
  beforeEach(() => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean(cls) as never);
    jest.spyOn(TutorProfileModel, 'findOne').mockReturnValue(lean(null) as never);
    jest.spyOn(StudentProfileModel, 'findOne').mockReturnValue(lean(null) as never);
    jest.spyOn(ParentProfileModel, 'findOne').mockReturnValue(lean(null) as never);
  });

  it('is null for strangers and unknown classes', async () => {
    await expect(membership.getClassMembership({ publicId: 'x', role: 'STUDENT' }, 'c1')).resolves.toBeNull();
    (ScheduledClassModel.findOne as jest.Mock).mockReturnValue(lean(null));
    await expect(membership.getClassMembership({ publicId: 'x', role: 'ADMIN' }, 'c1')).resolves.toBeNull();
  });

  it('classifies tutor, student, admin and parent', async () => {
    (TutorProfileModel.findOne as jest.Mock).mockReturnValue(lean({ publicId: 't-1' }));
    await expect(membership.getClassMembership({ publicId: 'tu', role: 'TUTOR' }, 'c1')).resolves.toBe('tutor');
    (TutorProfileModel.findOne as jest.Mock).mockReturnValue(lean(null));
    (StudentProfileModel.findOne as jest.Mock).mockReturnValue(lean({ publicId: 's-1' }));
    await expect(membership.getClassMembership({ publicId: 'su', role: 'STUDENT' }, 'c1')).resolves.toBe('student');
    (StudentProfileModel.findOne as jest.Mock).mockReturnValue(lean(null));
    await expect(membership.getClassMembership({ publicId: 'a', role: 'ADMIN' }, 'c1')).resolves.toBe('observer');
    (ParentProfileModel.findOne as jest.Mock).mockReturnValue(lean({ childStudentPublicIds: ['s-1'] }));
    await expect(membership.getClassMembership({ publicId: 'p', role: 'PARENT' }, 'c1')).resolves.toBe('observer');
    (ParentProfileModel.findOne as jest.Mock).mockReturnValue(lean({ childStudentPublicIds: ['other'] }));
    await expect(membership.getClassMembership({ publicId: 'p', role: 'PARENT' }, 'c1')).resolves.toBeNull();
  });
});

describe('class socket', () => {
  it('does not join or relay for a non-member', async () => {
    jest.spyOn(membership, 'getClassMembership').mockResolvedValue(null);
    const { socket, io, fire, relayed } = fakeSocket('x', 'STUDENT');
    registerClassSocket(io, socket);
    const ack = jest.fn();
    await fire('class:join', 'c1', ack);
    expect(socket.rooms.has('class:c1')).toBe(false);
    expect(ack).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
    await fire('wb:update', { classPublicId: 'c1', elements: [], appState: {} });
    expect(relayed).toHaveLength(0);
  });

  it('observers join but cannot relay wb:update or rtc; students can relay', async () => {
    const spy = jest.spyOn(membership, 'getClassMembership').mockResolvedValue('observer');
    const obs = fakeSocket('p', 'PARENT');
    registerClassSocket(obs.io, obs.socket);
    await obs.fire('class:join', 'c1');
    expect(obs.socket.rooms.has('class:c1')).toBe(true);
    obs.relayed.length = 0;
    await obs.fire('wb:update', { classPublicId: 'c1', elements: [], appState: {} });
    await obs.fire('rtc:ready', { classPublicId: 'c1' });
    expect(obs.relayed).toHaveLength(0);

    spy.mockResolvedValue('student');
    const stu = fakeSocket('s', 'STUDENT');
    registerClassSocket(stu.io, stu.socket);
    await stu.fire('class:join', 'c1');
    stu.relayed.length = 0;
    await stu.fire('wb:update', { classPublicId: 'c1', elements: [], appState: {} });
    expect(stu.relayed).toEqual([{ room: 'class:c1', event: 'wb:update' }]);
  });

  it('ignores wb:update for a class the socket never joined', async () => {
    const { socket, io, fire, relayed } = fakeSocket('s', 'STUDENT');
    registerClassSocket(io, socket);
    await fire('wb:update', { classPublicId: 'other', elements: [], appState: {} });
    expect(relayed).toHaveLength(0);
  });
});

describe('chat:join', () => {
  it('joins only participants', async () => {
    jest.spyOn(chatService, 'getConversations').mockResolvedValue([] as never);
    const spy = jest.spyOn(chatService, 'isParticipant').mockResolvedValue(false);
    const { socket, io, fire } = fakeSocket('u1', 'STUDENT');
    registerChatSocket(io, socket);
    const ack = jest.fn();
    await fire('chat:join', 'conv-1', ack);
    expect(socket.rooms.has('chat:conv-1')).toBe(false);
    expect(ack).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));

    spy.mockResolvedValue(true);
    await fire('chat:join', 'conv-1', ack);
    expect(socket.rooms.has('chat:conv-1')).toBe(true);
    expect(spy).toHaveBeenCalledWith('conv-1', 'u1');
  });
});
