export interface IConversation {
  publicId: string;
  participantPublicIds: [string, string];
  participantRoles: [string, string];
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
  createdAt: string;
}
