export const TicketStatus = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
} as const;
export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];

export const TicketCategory = {
  BILLING: 'BILLING',
  TECHNICAL: 'TECHNICAL',
  CLASS: 'CLASS',
  ACCOUNT: 'ACCOUNT',
  OTHER: 'OTHER',
} as const;
export type TicketCategory = (typeof TicketCategory)[keyof typeof TicketCategory];

export const TicketPriority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;
export type TicketPriority = (typeof TicketPriority)[keyof typeof TicketPriority];

export interface ITicket {
  _id: string;
  publicId: string;
  requesterPublicId: string;
  assigneePublicId?: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITicketMessage {
  _id: string;
  publicId: string;
  ticketPublicId: string;
  senderPublicId: string;
  body: string;
  isInternal: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTicketDto {
  subject: string;
  category: TicketCategory;
  priority?: TicketPriority;
  body: string;
}

export interface UpdateTicketDto {
  status?: TicketStatus;
  assigneePublicId?: string;
  priority?: TicketPriority;
}

export interface AddMessageDto {
  body: string;
  isInternal?: boolean;
}
