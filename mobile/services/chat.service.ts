import { api } from '../lib/api';

export interface Conversation {
  publicId: string;
  participantPublicIds: [string, string];
  participantRoles: [string, string];
  participantNames?: [string, string];
  lastMessageAt?: string;
  lastMessagePreview?: string;
  unreadCounts: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  publicId: string;
  conversationPublicId: string;
  senderPublicId: string;
  body: string;
  isRead: boolean;
  readAt?: string;
  deletedFor?: string[];
  reactions?: Record<string, string[]>;
  pinnedUntil?: string;
  pinnedBy?: string;
  replyToPublicId?: string;
  replyToBody?: string;
  replyToSender?: string;
  mediaPublicId?: string;
  mediaMimeType?: string;
  mediaName?: string;
  mediaSizeBytes?: number;
  createdAt: string;
}

export interface SendMessagePayload {
  body?: string;
  mediaPublicId?: string;
  mediaMimeType?: string;
  mediaName?: string;
  mediaSizeBytes?: number;
  replyToPublicId?: string;
  replyToBody?: string;
  replyToSender?: string;
}

function unwrap<T>(d: unknown): T {
  const obj = d as { data?: T };
  return (obj?.data ?? d) as T;
}

export const chatService = {
  getConversations: (): Promise<Conversation[]> =>
    api.get('/chat/conversations').then((r) => unwrap<Conversation[]>(r.data) ?? []),

  getUnreadCount: (): Promise<number> =>
    api.get('/chat/conversations/unread-count').then((r) => r.data?.count ?? unwrap<{ count?: number }>(r.data)?.count ?? 0),

  getMessages: (conversationPublicId: string, params?: { limit?: string }): Promise<Message[]> =>
    api.get(`/chat/conversations/${conversationPublicId}/messages`, { params }).then((r) => {
      const d = r.data?.data ?? r.data;
      return (Array.isArray(d) ? d : d?.items ?? []) as Message[];
    }),

  startConversation: (recipientPublicId: string, recipientRole: string): Promise<Conversation> =>
    api.post('/chat/conversations', { recipientPublicId, recipientRole }).then((r) => unwrap<Conversation>(r.data)),

  sendMessage: (conversationPublicId: string, payload: SendMessagePayload): Promise<Message> =>
    api.post(`/chat/conversations/${conversationPublicId}/messages`, payload).then((r) => unwrap<Message>(r.data)),

  markRead: (conversationPublicId: string): Promise<void> =>
    api.patch(`/chat/conversations/${conversationPublicId}/read`).then(() => undefined),

  deleteMessage: (conversationPublicId: string, messagePublicId: string, forEveryone: boolean): Promise<void> =>
    api.delete(`/chat/conversations/${conversationPublicId}/messages/${messagePublicId}`, { params: { forEveryone } }).then(() => undefined),

  reactToMessage: (conversationPublicId: string, messagePublicId: string, emoji: string): Promise<Message> =>
    api.post(`/chat/conversations/${conversationPublicId}/messages/${messagePublicId}/react`, { emoji }).then((r) => unwrap<Message>(r.data)),

  pinMessage: (conversationPublicId: string, messagePublicId: string, durationHours: number): Promise<Message> =>
    api.post(`/chat/conversations/${conversationPublicId}/messages/${messagePublicId}/pin`, { durationHours }).then((r) => unwrap<Message>(r.data)),

  unpinMessage: (conversationPublicId: string, messagePublicId: string): Promise<void> =>
    api.post(`/chat/conversations/${conversationPublicId}/messages/${messagePublicId}/unpin`).then(() => undefined),
};