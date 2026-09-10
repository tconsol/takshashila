import { api } from '../lib/axios';

export interface AudienceEstimate {
  total: number;
  byRole: { role: string; count: number }[];
}

export interface BroadcastRecord {
  broadcastId: string;
  title: string;
  body: string;
  channel: string;
  sentAt: string;
  sentByName: string;
  recipients: number;
  readCount: number;
}

export interface SendBroadcastDto {
  title: string;
  body: string;
  /** Omit or empty for every role. */
  roles?: string[];
  alsoEmail?: boolean;
}

export const broadcastService = {
  estimateAudience: (roles: string[]): Promise<AudienceEstimate> =>
    api
      .get('/notifications/broadcast/audience', { params: roles.length ? { roles: roles.join(',') } : {} })
      .then((r) => r.data.data),

  history: (): Promise<BroadcastRecord[]> =>
    api.get('/notifications/broadcast/history').then((r) => r.data.data),

  send: (dto: SendBroadcastDto): Promise<{ broadcastId: string; delivered: number; emailsQueued: number }> =>
    api.post('/notifications/broadcast', dto).then((r) => r.data.data),
};
