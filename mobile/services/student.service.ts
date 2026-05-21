import { api } from '../lib/api';
import type { StudentProfile } from '../types/api.types';

export const studentService = {
  getMyProfile: (): Promise<StudentProfile> =>
    api.get('/students/me').then((r) => r.data.data),

  acceptInvite: (): Promise<StudentProfile> =>
    api.post('/students/me/accept-invite').then((r) => r.data.data),

  declineInvite: (): Promise<void> =>
    api.post('/students/me/decline-invite').then(() => undefined),
};
