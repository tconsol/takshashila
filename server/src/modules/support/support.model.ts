import mongoose, { Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { TicketStatus, TicketCategory, TicketPriority } from './support.types';
import type { ITicket, ITicketMessage } from './support.types';

const ticketSchema = new Schema<ITicket>(
  {
    publicId: { type: String, default: uuidv4, unique: true, index: true },
    requesterPublicId: { type: String, required: true, index: true },
    assigneePublicId: { type: String },
    subject: { type: String, required: true, maxlength: 255 },
    category: { type: String, enum: Object.values(TicketCategory), required: true },
    priority: { type: String, enum: Object.values(TicketPriority), default: TicketPriority.MEDIUM },
    status: { type: String, enum: Object.values(TicketStatus), default: TicketStatus.OPEN },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { transform: (_doc, ret: Record<string, unknown>) => { delete ret.__v; return ret; } },
  },
);

ticketSchema.index({ status: 1, createdAt: -1 });
ticketSchema.index({ assigneePublicId: 1, status: 1 });

const ticketMessageSchema = new Schema<ITicketMessage>(
  {
    publicId: { type: String, default: uuidv4, unique: true, index: true },
    ticketPublicId: { type: String, required: true, index: true },
    senderPublicId: { type: String, required: true },
    body: { type: String, required: true, maxlength: 5000 },
    isInternal: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { transform: (_doc, ret: Record<string, unknown>) => { delete ret.__v; return ret; } },
  },
);

export const TicketModel = mongoose.model<ITicket>('Ticket', ticketSchema);
export const TicketMessageModel = mongoose.model<ITicketMessage>('TicketMessage', ticketMessageSchema);

