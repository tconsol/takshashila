export interface IConversation {
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

export interface IMessage {
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
