/* start and meeting-url must go through assertClassParty (no student, owner only). */
jest.mock('../../modules/classes/class-access', () => ({ assertClassParty: jest.fn() }));
import { classController } from '../../modules/classes/class.controller';
import { classService } from '../../modules/classes/class.service';
import { assertClassParty } from '../../modules/classes/class-access';
import { NotFoundError } from '../../utils/error';

const mkRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });
const user = { publicId: 'u1', role: 'TUTOR' };
const req = { user, params: { classId: 'c1' }, body: {} } as never;

describe.each(['startClass', 'setMeetingUrl'] as const)('ClassController.%s ownership', (method) => {
  beforeEach(() => { jest.restoreAllMocks(); (assertClassParty as jest.Mock).mockReset(); });

  it('checks assertClassParty with allowStudent:false before acting', async () => {
    const spy = jest.spyOn(classService, method).mockResolvedValue({} as never);
    (assertClassParty as jest.Mock).mockResolvedValue(undefined);
    await classController[method](req, mkRes() as never, jest.fn());
    expect(assertClassParty).toHaveBeenCalledWith(user, 'c1', { allowStudent: false });
    expect(spy).toHaveBeenCalled();
  });

  it('does not act and forwards the error for a non-party', async () => {
    const spy = jest.spyOn(classService, method).mockResolvedValue({} as never);
    (assertClassParty as jest.Mock).mockRejectedValue(new NotFoundError('Scheduled class'));
    const next = jest.fn();
    await classController[method](req, mkRes() as never, next);
    expect(spy).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
  });
});
