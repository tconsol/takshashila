import * as access from './material-access';
import type { MaterialLike } from './material-access';
import { NotFoundError } from '../../utils/error';

/** 404 (not 403) so existence isn't revealed. Legacy items pass through canViewMaterial. */
export async function assertCanViewMaterial(user: { role: string; publicId: string }, m: MaterialLike): Promise<void> {
  // Called through the module object so tests can spy on canViewMaterial.
  if (!(await access.canViewMaterial({ role: user.role, userPublicId: user.publicId }, m))) {
    throw new NotFoundError('Material');
  }
}
