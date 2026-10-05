/* Completing or cancelling a class must tell the live room, and an ended class gets no video token. */
jest.mock('../../modules/realtime/realtime.service', () => ({ realtime: { emit: jest.fn().mockResolvedValue('none') } }));
import { registerDataInvalidationSocket, endClassRoom, notifyClassEnded } from '../../sockets/data.socket';
import { realtime } from '../../modules/realtime/realtime.service';
import { domainEvents } from '../../events/event-emitter';
import { DomainEvent } from '../../constants/events';
import { classController } from '../../modules/classes/class.controller';
import { ScheduledClassModel } from '../../modules/schedules/schedule.model';

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });

function fakeIo() {
  const emit = jest.fn();
  const to = jest.fn().mockReturnValue({ emit });
  return { io: { to } as never, to, emit };
}

describe('class room end notification', () => {
  it('emits class:status-changed to the class room', () => {
    const { io, to, emit } = fakeIo();
    endClassRoom(io, 'c1', 'COMPLETED');
    expect(to).toHaveBeenCalledWith('class:c1');
    expect(emit).toHaveBeenCalledWith('class:status-changed', expect.objectContaining({ classPublicId: 'c1', status: 'COMPLETED' }));
  });

  it('keeps a group room open while another record of the session is still running', () => {
    const { io, to } = fakeIo();
    endClassRoom(io, 'g1', 'CANCELLED', false);
    expect(to).not.toHaveBeenCalled();
  });

  it('does nothing without a class id', () => {
    const { io, to } = fakeIo();
    endClassRoom(io, undefined, 'CANCELLED');
    expect(to).not.toHaveBeenCalled();
  });

  it.each([
    [DomainEvent.CLASS_COMPLETED, 'COMPLETED'],
    [DomainEvent.CLASS_CANCELLED, 'CANCELLED'],
  ])('%s closes the room with status %s', (event, status) => {
    domainEvents.removeAllListeners();
    const { io, to, emit } = fakeIo();
    registerDataInvalidationSocket(io);
    domainEvents.emit(event, { classPublicId: 'c9', tutorUserPublicId: 't', studentUserPublicId: 's' });
    expect(to).toHaveBeenCalledWith('class:c9');
    expect(emit).toHaveBeenCalledWith('class:status-changed', expect.objectContaining({ status }));
    domainEvents.removeAllListeners();
  });
});

describe('notifyClassEnded (reaches people on any server instance)', () => {
  const emit = realtime.emit as jest.Mock;
  beforeEach(() => emit.mockClear());

  it('tells the student and the tutor when the whole room has ended', () => {
    notifyClassEnded({ classPublicId: 'c1', roomPublicId: 'g1', roomEnded: true, tutorUserPublicId: 't', studentUserPublicId: 's' }, 'COMPLETED');
    expect(emit).toHaveBeenCalledWith(['user:s', 'user:t'], 'class:status-changed',
      expect.objectContaining({ classPublicId: 'c1', roomPublicId: 'g1', roomEnded: true, status: 'COMPLETED' }));
  });

  it('tells only the student when other records of the group are still running', () => {
    notifyClassEnded({ classPublicId: 'c1', roomPublicId: 'g1', roomEnded: false, tutorUserPublicId: 't', studentUserPublicId: 's' }, 'CANCELLED');
    expect(emit.mock.calls[0][0]).toEqual(['user:s']);
    expect(emit.mock.calls[0][2]).toMatchObject({ roomEnded: false, status: 'CANCELLED' });
  });

  it('treats a single class (no room info) as ended for both people', () => {
    notifyClassEnded({ classPublicId: 'c1', tutorUserPublicId: 't', studentUserPublicId: 's' }, 'COMPLETED');
    expect(emit.mock.calls[0][0]).toEqual(['user:s', 'user:t']);
    expect(emit.mock.calls[0][2]).toMatchObject({ roomPublicId: 'c1', roomEnded: true });
  });

  it('sends nothing without a class id', () => {
    notifyClassEnded({ tutorUserPublicId: 't', studentUserPublicId: 's' }, 'COMPLETED');
    expect(emit).not.toHaveBeenCalled();
  });

  it('is sent when a class is completed through the domain event', () => {
    domainEvents.removeAllListeners();
    registerDataInvalidationSocket({ to: jest.fn().mockReturnValue({ emit: jest.fn() }) } as never);
    domainEvents.emit(DomainEvent.CLASS_COMPLETED, { classPublicId: 'c9', tutorUserPublicId: 't', studentUserPublicId: 's' });
    expect(emit.mock.calls.some(([, event]) => event === 'class:status-changed')).toBe(true);
    domainEvents.removeAllListeners();
  });
});

describe('ClassController.getAgoraToken for an ended class', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each(['COMPLETED', 'CANCELLED'])('refuses a token when the class is %s', async (status) => {
    jest.spyOn(ScheduledClassModel, 'findOne').mockReturnValue(lean({ publicId: 'c1', status, tutorPublicId: 't' }) as never);
    const next = jest.fn();
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    await classController.getAgoraToken({ user: { publicId: 'u', role: 'TUTOR' }, params: { classId: 'c1' } } as never, res as never, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409, message: 'This class has ended' }));
    expect(res.json).not.toHaveBeenCalled();
  });
});
