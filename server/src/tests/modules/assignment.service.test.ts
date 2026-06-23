import { AssignmentService } from '../../modules/assignments/assignment.service';
import { AssignmentModel, SubmissionModel } from '../../modules/assignments/assignment.model';
import { AssignmentStatus } from '../../modules/assignments/assignment.types';

jest.mock('../../modules/assignments/assignment.model');
jest.mock('../../events/event-emitter', () => ({
  domainEvents: { emit: jest.fn() },
}));

// Helper: mongoose .lean() chainable mock
const lean = (val: unknown) => ({ lean: () => Promise.resolve(val) });

describe('AssignmentService', () => {
  let service: AssignmentService;

  beforeEach(() => {
    service = new AssignmentService();
    jest.clearAllMocks();
  });

  describe('publish', () => {
    it('throws 404 when assignment not found', async () => {
      (AssignmentModel.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.publish('pub-1', 'tutor-1')).rejects.toMatchObject({ statusCode: 404 });
    });

    it('throws 409 (conflict) when already published', async () => {
      (AssignmentModel.findOne as jest.Mock).mockResolvedValue({ status: AssignmentStatus.PUBLISHED });
      await expect(service.publish('pub-1', 'tutor-1')).rejects.toMatchObject({ statusCode: 409 });
    });

    it('publishes a DRAFT assignment', async () => {
      (AssignmentModel.findOne as jest.Mock).mockResolvedValue({ status: AssignmentStatus.DRAFT });
      (AssignmentModel.findOneAndUpdate as jest.Mock).mockReturnValue(
        lean({ publicId: 'pub-1', status: AssignmentStatus.PUBLISHED }),
      );

      const result = await service.publish('pub-1', 'tutor-1');

      expect(AssignmentModel.findOneAndUpdate).toHaveBeenCalledWith(
        { publicId: 'pub-1' },
        { $set: { status: AssignmentStatus.PUBLISHED } },
        { new: true },
      );
      expect(result.status).toBe(AssignmentStatus.PUBLISHED);
    });
  });

  describe('gradeSubmission', () => {
    it('throws 403 when tutor does not own the assignment', async () => {
      (SubmissionModel.findOne as jest.Mock).mockResolvedValue({ assignmentPublicId: 'asgn-1' });
      (AssignmentModel.findOne as jest.Mock).mockResolvedValue({ tutorPublicId: 'someone-else', maxScore: 100 });
      await expect(
        service.gradeSubmission('sub-1', 'tutor-1', { score: 50, feedback: '' }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('throws 422 if score exceeds maxScore', async () => {
      (SubmissionModel.findOne as jest.Mock).mockResolvedValue({ assignmentPublicId: 'asgn-1' });
      (AssignmentModel.findOne as jest.Mock).mockResolvedValue({ tutorPublicId: 'tutor-1', maxScore: 100 });
      await expect(
        service.gradeSubmission('sub-1', 'tutor-1', { score: 150, feedback: '' }),
      ).rejects.toMatchObject({ statusCode: 422 });
    });
  });
});
