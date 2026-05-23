import { AssignmentService } from '../../modules/assignments/assignment.service';
import { AssignmentModel, SubmissionModel } from '../../modules/assignments/assignment.model';
import { AssignmentStatus, SubmissionStatus } from '../../modules/assignments/assignment.types';

jest.mock('../../modules/assignments/assignment.model');
jest.mock('../../events/event-emitter', () => ({
  domainEvents: { emit: jest.fn() },
}));

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

    it('throws 400 when already published', async () => {
      (AssignmentModel.findOne as jest.Mock).mockResolvedValue({
        status: AssignmentStatus.PUBLISHED,
        save: jest.fn(),
      });
      await expect(service.publish('pub-1', 'tutor-1')).rejects.toMatchObject({ statusCode: 400 });
    });

    it('publishes a DRAFT assignment', async () => {
      const mockSave = jest.fn();
      const mockAssignment = { status: AssignmentStatus.DRAFT, save: mockSave, toObject: () => ({}) };
      (AssignmentModel.findOne as jest.Mock).mockResolvedValue(mockAssignment);

      await service.publish('pub-1', 'tutor-1');

      expect(mockAssignment.status).toBe(AssignmentStatus.PUBLISHED);
      expect(mockSave).toHaveBeenCalled();
    });
  });

  describe('gradeSubmission', () => {
    it('throws 400 if score exceeds maxScore', async () => {
      const mockSubmission = { assignmentPublicId: 'asgn-1' };
      const mockAssignment = { maxScore: 100 };
      (SubmissionModel.findOne as jest.Mock).mockResolvedValue(mockSubmission);
      (AssignmentModel.findOne as jest.Mock).mockResolvedValue(mockAssignment);

      await expect(
        service.gradeSubmission('sub-1', 'tutor-1', { score: 150, feedback: '' }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });
});
