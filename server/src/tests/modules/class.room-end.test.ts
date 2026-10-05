/* Completing or cancelling a class must tell the live room, and an ended class gets no video token. */
jest.mock('../../modules/realtime/realtime.service', () => ({ realtime: { emit: jest.fn().mockResolvedValue('none') } }));
import { registerDataInvalidationSocket, endClassRoom } from '../../sockets/data.socket';
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
