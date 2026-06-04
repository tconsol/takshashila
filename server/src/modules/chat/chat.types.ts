export interface IConversation {
  _id: string;
  publicId: string;
  participantPublicIds: [string, string];
  participantRoles: [string, string];
  lastMessageAt?: Date;
  lastMessagePreview?: string;
  unreadCounts: Record<string, number>;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMessage {
  _id: string;
  publicId: string;
  conversationPublicId: string;
  senderPublicId: string;
  body: string;
  isRead: boolean;
  readAt?: Date;
  deletedFor: string[];
  reactions: Record<string, string[]>;
  pinnedUntil?: Date;
  pinnedBy?: string;
  replyToPublicId?: string;
  replyToBody?: string;
  replyToSender?: string;
  mediaPublicId?: string;
  mediaMimeType?: string;
  mediaName?: string;
  mediaSizeBytes?: number;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface StartConversationDto {
  recipientPublicId: string;
}

export interface SendMessageDto {
  body?: string;
  mediaPublicId?: string;
  mediaMimeType?: string;
  mediaName?: string;
  mediaSizeBytes?: number;
  replyToPublicId?: string;
  replyToBody?: string;
  replyToSender?: string;
}
