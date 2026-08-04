import { api } from '../lib/api';

export interface AppNotification {
  publicId: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  data?: Record<string, unknown>;
  createdAt: string;
}

export const notificationsService = {
  getMine: (params?: { limit?: string }): Promise<AppNotification[]> =>
    api.get('/notifications', { params }).then((r) => {
      const root = r.data;
      const d = root?.data ?? root;
      return (Array.isArray(d) ? d : d?.items ?? []) as AppNotification[];
    }),

  getUnreadCount: (): Promise<number> =>
    api.get('/notifications/unread-count').then((r) => r.data?.data?.count ?? r.data?.count ?? 0),

  markRead: (publicId: string): Promise<void> =>
    api.patch(`/notifications/${publicId}/read`).then(() => undefined),

  markAllRead: (): Promise<void> =>
    api.patch('/notifications/read-all').then(() => undefined),
};
