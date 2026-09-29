import { ChatService } from '../../modules/chat/chat.service';
import { MessageModel, ConversationModel } from '../../modules/chat/chat.model';

const makeMsg = (conv = 'c1', sender = 'u1') => ({
  publicId: 'm1', conversationPublicId: conv, senderPublicId: sender, reactions: new Map(), deletedFor: [] as string[],
  save: jest.fn().mockResolvedValue(undefined),
  toObject: () => ({ publicId: 'm1', conversationPublicId: conv }),
});

describe('ChatService.assertMessageAccess and callers', () => {
  const service = new ChatService();
  let updateOne: jest.SpyInstance;
  let convFind: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(MessageModel, 'findOne').mockResolvedValue(makeMsg() as never);
    convFind = jest.spyOn(ConversationModel, 'findOne').mockReturnValue({ lean: () => Promise.resolve({ publicId: 'c1', participantPublicIds: ['u1'] }) } as never);
    updateOne = jest.spyOn(MessageModel, 'updateOne').mockResolvedValue({} as never);
  });

  it('returns the message for a participant', async () => {
    await expect(service.assertMessageAccess('c1', 'm1', 'u1')).resolves.toMatchObject({ publicId: 'm1' });
    expect(convFind).toHaveBeenCalledWith(expect.objectContaining({ publicId: 'c1', participantPublicIds: 'u1' }));
  });
  it('404s when the message belongs to another conversation', async () => {
    await expect(service.assertMessageAccess('other-conv', 'm1', 'u1')).rejects.toMatchObject({ statusCode: 404 });
  });
  it('404s when the message is missing', async () => {
    (MessageModel.findOne as jest.Mock).mockResolvedValue(null);
    await expect(service.assertMessageAccess('c1', 'm1', 'u1')).rejects.toMatchObject({ statusCode: 404 });
  });
  it('404s for a non-participant', async () => {
    convFind.mockReturnValue({ lean: () => Promise.resolve(null) });
    await expect(service.assertMessageAccess('c1', 'm1', 'intruder')).rejects.toMatchObject({ statusCode: 404 });
  });

  describe.each([
    ['react', (c: string, u: string) => service.reactToMessage(c, 'm1', u, 'thumbs-up')],
    ['pin', (c: string, u: string) => service.pinMessage(c, 'm1', u, 1)],
    ['unpin', (c: string, u: string) => service.unpinMessage(c, 'm1', u)],
    ['delete', (c: string, u: string) => service.deleteMessage(c, 'm1', u, false)],
  ])('%s', (_name, call) => {
    it('blocks wrong conversation id with 404', async () => {
      await expect(call('wrong', 'u1')).rejects.toMatchObject({ statusCode: 404 });
      expect(updateOne).not.toHaveBeenCalled();
    });
    it('blocks a non-participant with 404', async () => {
      convFind.mockReturnValue({ lean: () => Promise.resolve(null) });
      await expect(call('c1', 'intruder')).rejects.toMatchObject({ statusCode: 404 });
      expect(updateOne).not.toHaveBeenCalled();
    });
    it('allows a participant', async () => {
      await expect(call('c1', 'u1')).resolves.not.toThrow();
    });
  });
});
