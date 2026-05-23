import { NotificationService } from '../../modules/notifications/notification.service';
import { NotificationModel } from '../../modules/notifications/notification.model';
import { domainEvents } from '../../events/event-emitter';

jest.mock('../../modules/notifications/notification.model');
jest.mock('../../events/event-emitter', () => ({
  domainEvents: { emit: jest.fn(), on: jest.fn() },
}));

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    service = new NotificationService();
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates a notification and emits NOTIFICATION_SENT', async () => {
      const mockNotification = {
        publicId: 'pub-1',
        toObject: () => ({ publicId: 'pub-1', recipientPublicId: 'user-1', type: 'SYSTEM' }),
      };
      (NotificationModel.create as jest.Mock).mockResolvedValue(mockNotification);

      const dto = {
        recipientPublicId: 'user-1',
        type: 'SYSTEM' as const,
        title: 'Test',
        body: 'Test body',
      };

      const result = await service.create(dto);

      expect(NotificationModel.create).toHaveBeenCalledWith(expect.objectContaining({
        recipientPublicId: 'user-1',
        type: 'SYSTEM',
        isRead: false,
      }));
      expect(domainEvents.emit).toHaveBeenCalledWith('NOTIFICATION_SENT', expect.any(Object));
      expect(result.publicId).toBe('pub-1');
    });
  });

  describe('getUnreadCount', () => {
    it('queries with correct filter', async () => {
      (NotificationModel.countDocuments as jest.Mock).mockResolvedValue(5);
      const count = await service.getUnreadCount('user-1');
      expect(count).toBe(5);
      expect(NotificationModel.countDocuments).toHaveBeenCalledWith({
        recipientPublicId: 'user-1',
        isRead: false,
        isDeleted: false,
      });
    });
  });

  describe('markRead', () => {
    it('updates with correct filter', async () => {
      (NotificationModel.updateOne as jest.Mock).mockResolvedValue({ modifiedCount: 1 });
      await service.markRead('notif-1', 'user-1');
      expect(NotificationModel.updateOne).toHaveBeenCalledWith(
        { publicId: 'notif-1', recipientPublicId: 'user-1', isDeleted: false },
        expect.objectContaining({ $set: expect.objectContaining({ isRead: true }) }),
      );
    });
  });
});
