import mongoose, { Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import type { IConversation, IMessage } from './chat.types';

const conversationSchema = new Schema<IConversation>(
  {
    publicId: { type: String, default: uuidv4, unique: true, index: true },
    participantPublicIds: { type: [String], required: true },
    participantRoles: { type: [String], required: true },
    lastMessageAt: { type: Date },
    lastMessagePreview: { type: String, maxlength: 100 },
    unreadCounts: { type: Map, of: Number, default: {} },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { transform: (_doc, ret: Record<string, unknown>) => { delete ret.__v; return ret; } },
  },
);

// Ensure a pair of participants can only have one conversation
conversationSchema.index({ participantPublicIds: 1 }, { unique: false });
conversationSchema.index(
  { 'participantPublicIds.0': 1, 'participantPublicIds.1': 1 },
  { unique: false },
);

const messageSchema = new Schema<IMessage>(
  {
    publicId: { type: String, default: uuidv4, unique: true, index: true },
    conversationPublicId: { type: String, required: true, index: true },
    senderPublicId: { type: String, required: true },
    body: { type: String, default: '', maxlength: 4000 },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
    mediaPublicId: { type: String },
    mediaMimeType: { type: String },
    mediaName: { type: String },
    mediaSizeBytes: { type: Number },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { transform: (_doc, ret: Record<string, unknown>) => { delete ret.__v; return ret; } },
  },
);

messageSchema.index({ conversationPublicId: 1, createdAt: -1 });

export const ConversationModel = mongoose.model<IConversation>('Conversation', conversationSchema);
export const MessageModel = mongoose.model<IMessage>('Message', messageSchema);

