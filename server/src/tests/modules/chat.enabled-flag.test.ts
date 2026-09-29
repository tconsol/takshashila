import { ChatService } from '../../modules/chat/chat.service';
import { ConversationModel, MessageModel } from '../../modules/chat/chat.model';
import { settingsService } from '../../modules/settings/settings.service';

describe('ChatService.sendMessage chatEnabled flag', () => {
  const service = new ChatService();

  it('rejects with 403 when chat is disabled and creates nothing', async () => {
    const flag = jest.spyOn(settingsService, 'isFeatureEnabled').mockResolvedValue(false);
    const create = jest.spyOn(MessageModel, 'create');
    await expect(service.sendMessage('c1', 'u1', { body: 'hi' })).rejects.toMatchObject({
      statusCode: 403,
      message: expect.stringContaining('disabled'),
    });
    expect(create).not.toHaveBeenCalled();
    expect(flag).toHaveBeenCalledWith('chatEnabled');
  });

  it('proceeds when enabled', async () => {
    jest.spyOn(settingsService, 'isFeatureEnabled').mockResolvedValue(true);
    jest.spyOn(ConversationModel, 'findOne').mockResolvedValue({ participantPublicIds: ['u1', 'u2'] } as never);
    jest.spyOn(MessageModel, 'create').mockResolvedValue({ toObject: () => ({ publicId: 'm' }) } as never);
    jest.spyOn(ConversationModel, 'updateOne').mockResolvedValue({} as never);
    await expect(service.sendMessage('c1', 'u1', { body: 'hi' })).resolves.toMatchObject({ publicId: 'm' });
  });
});
