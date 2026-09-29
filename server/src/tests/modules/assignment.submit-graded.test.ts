import { AssignmentService } from '../../modules/assignments/assignment.service';
import { AssignmentModel, SubmissionModel } from '../../modules/assignments/assignment.model';
import { AssignmentStatus, SubmissionStatus } from '../../modules/assignments/assignment.types';

jest.mock('../../modules/assignments/assignment.model');
jest.mock('../../events/event-emitter', () => ({ domainEvents: { emit: jest.fn() } }));

const lean = (v: unknown) => ({ lean: () => Promise.resolve(v) });

describe('AssignmentService.submit after grading', () => {
  const service = new AssignmentService();

  beforeEach(() => {
    jest.resetAllMocks();
  });

  // Automocked models share one inherited static findOne, so queue results in call order:
  // first the assignment, then the existing submission.
  const queue = (existing: unknown) => {
    (AssignmentModel.findOne as jest.Mock)
      .mockResolvedValueOnce({
        publicId: 'a1', status: AssignmentStatus.PUBLISHED, authorRole: 'TUTOR', dueDate: new Date(Date.now() + 86400000),
      })
      .mockResolvedValueOnce(existing);
  };

  it('409s and writes nothing when the submission is already GRADED', async () => {
    queue({ status: SubmissionStatus.GRADED });
    await expect(service.submit('a1', 's1', { content: 'again' } as never)).rejects.toMatchObject({ statusCode: 409 });
    expect(SubmissionModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(SubmissionModel.create).not.toHaveBeenCalled();
  });

  it('still allows resubmitting a SUBMITTED (ungraded) submission', async () => {
    queue({ status: SubmissionStatus.SUBMITTED });
    (SubmissionModel.findOneAndUpdate as jest.Mock).mockReturnValue(lean({ publicId: 'sub-1' }));
    await expect(service.submit('a1', 's1', { content: 'v2' } as never)).resolves.toMatchObject({ publicId: 'sub-1' });
  });

  it('creates a first submission when none exists', async () => {
    queue(null);
    (SubmissionModel.create as jest.Mock).mockResolvedValue({ publicId: 'new', toObject: () => ({ publicId: 'new' }) });
    await expect(service.submit('a1', 's1', { content: 'v1' } as never)).resolves.toBeDefined();
    expect(SubmissionModel.create).toHaveBeenCalled();
  });
});
