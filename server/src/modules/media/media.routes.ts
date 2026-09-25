import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../shared/types';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { mediaService } from './media.service';
import { canReadMedia } from './media-access';
import { NotFoundError } from '../../utils/error';
import { sendSuccess, sendCreated } from '../../utils/response';

const router = Router();
router.use(authMiddleware);

router.post('/upload-url', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await mediaService.requestUploadUrl(req.user!.publicId, req.body);
    sendCreated(res, result, 'Upload URL generated');
  } catch (e) { next(e); }
});

router.post('/confirm', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const file = await mediaService.confirmUpload(req.user!.publicId, req.body);
    sendSuccess(res, file, 'Upload confirmed');
  } catch (e) { next(e); }
});

router.get('/:fileId/read-url', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!(await canReadMedia({ role: req.user!.role, userPublicId: req.user!.publicId }, req.params.fileId))) {
      throw new NotFoundError('Media file');
    }
    const url = await mediaService.getReadUrl(req.params.fileId, req.user!.publicId);
    sendSuccess(res, { url }, 'Read URL generated');
  } catch (e) { next(e); }
});

router.get('/entity/:entityId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const files = await mediaService.getByEntity(req.params.entityId);
    sendSuccess(res, files, 'Files fetched');
  } catch (e) { next(e); }
});

router.delete('/:fileId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await mediaService.softDelete(req.params.fileId, req.user!.publicId);
    sendSuccess(res, null, 'File deleted');
  } catch (e) { next(e); }
});

export default router;
