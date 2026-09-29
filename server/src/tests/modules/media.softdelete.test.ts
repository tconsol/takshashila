import { MediaService } from '../../modules/media/media.service';
import { MediaFileModel } from '../../modules/media/media.model';

describe('MediaService.softDelete ownership', () => {
  const service = new MediaService();
  let update: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(MediaFileModel, 'findOne').mockResolvedValue({ publicId: 'f1', uploaderPublicId: 'owner' } as never);
    update = jest.spyOn(MediaFileModel, 'findOneAndUpdate').mockResolvedValue({} as never);
  });

  it('lets the uploader delete', async () => {
    await expect(service.softDelete('f1', 'owner', 'STUDENT')).resolves.toBeUndefined();
    expect(update).toHaveBeenCalled();
  });
  it('returns 404 for another user and does not update', async () => {
    await expect(service.softDelete('f1', 'other', 'STUDENT')).rejects.toMatchObject({ statusCode: 404 });
    expect(update).not.toHaveBeenCalled();
  });
  it('returns 404 when role is omitted and user is not uploader', async () => {
    await expect(service.softDelete('f1', 'other')).rejects.toMatchObject({ statusCode: 404 });
  });
  it.each(['ADMIN', 'SUPER_ADMIN'])('lets %s delete any file', async (role) => {
    await expect(service.softDelete('f1', 'someone', role)).resolves.toBeUndefined();
    expect(update).toHaveBeenCalled();
  });
  it('returns 404 for a missing file even for admin', async () => {
    (MediaFileModel.findOne as jest.Mock).mockResolvedValue(null);
    await expect(service.softDelete('nope', 'a', 'ADMIN')).rejects.toMatchObject({ statusCode: 404 });
  });
});
