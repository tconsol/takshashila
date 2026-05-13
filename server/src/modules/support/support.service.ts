import { v4 as uuidv4 } from 'uuid';
import { TicketModel, TicketMessageModel } from './support.model';
import { TicketStatus, TicketPriority } from './support.types';
import type { ITicket, ITicketMessage, CreateTicketDto, UpdateTicketDto, AddMessageDto } from './support.types';
import type { PaginationQuery, PaginatedResult } from '../../shared/types';
import { parsePaginationQuery, buildPaginatedResult } from '../../utils/pagination';
import { notificationService } from '../notifications/notification.service';

export class SupportService {
  async createTicket(requesterPublicId: string, dto: CreateTicketDto): Promise<ITicket> {
    const ticket = await TicketModel.create({
      publicId: uuidv4(),
      requesterPublicId,
      subject: dto.subject,
      category: dto.category,
      priority: dto.priority ?? TicketPriority.MEDIUM,
      status: TicketStatus.OPEN,
    });

    await TicketMessageModel.create({
      publicId: uuidv4(),
      ticketPublicId: ticket.publicId,
      senderPublicId: requesterPublicId,
      body: dto.body,
      isInternal: false,
    });

    return ticket.toObject();
  }

  async listTickets(
    query: PaginationQuery & { status?: string; assigneePublicId?: string },
    filterByRequester?: string,
  ): Promise<PaginatedResult<ITicket>> {
    const { page, limit, skip } = parsePaginationQuery(query);
    const filter: Record<string, unknown> = { isDeleted: false };
    if (query.status) filter.status = query.status;
    if (query.assigneePublicId) filter.assigneePublicId = query.assigneePublicId;
    if (filterByRequester) filter.requesterPublicId = filterByRequester;

    const [items, total] = await Promise.all([
      TicketModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      TicketModel.countDocuments(filter),
    ]);
    return buildPaginatedResult(items, total, page, limit);
  }

  async getTicket(publicId: string): Promise<ITicket> {
    const ticket = await TicketModel.findOne({ publicId, isDeleted: false }).lean();
    if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
    return ticket;
  }

  async updateTicket(publicId: string, dto: UpdateTicketDto): Promise<ITicket> {
    const ticket = await TicketModel.findOneAndUpdate(
      { publicId, isDeleted: false },
      { $set: dto },
      { new: true },
    ).lean();
    if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });

    if (dto.status) {
      await notificationService.create({
        recipientPublicId: ticket.requesterPublicId,
        type: 'SUPPORT_TICKET_UPDATED' as const,
        title: 'Support Ticket Updated',
        body: `Your ticket "${ticket.subject}" is now ${dto.status}.`,
        data: { ticketPublicId: ticket.publicId },
      });
    }

    return ticket;
  }

  async getMessages(ticketPublicId: string, includeInternal: boolean): Promise<ITicketMessage[]> {
    const filter: Record<string, unknown> = { ticketPublicId };
    if (!includeInternal) filter.isInternal = false;
    return TicketMessageModel.find(filter).sort({ createdAt: 1 }).lean();
  }

  async addMessage(
    ticketPublicId: string,
    senderPublicId: string,
    dto: AddMessageDto,
  ): Promise<ITicketMessage> {
    const ticket = await TicketModel.findOne({ publicId: ticketPublicId, isDeleted: false });
    if (!ticket) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });

    const message = await TicketMessageModel.create({
      publicId: uuidv4(),
      ticketPublicId,
      senderPublicId,
      body: dto.body,
      isInternal: dto.isInternal ?? false,
    });

    if (ticket.status === TicketStatus.OPEN || ticket.status === TicketStatus.RESOLVED) {
      ticket.status = TicketStatus.IN_PROGRESS;
      await ticket.save();
    }

    if (senderPublicId !== ticket.requesterPublicId && !dto.isInternal) {
      await notificationService.create({
        recipientPublicId: ticket.requesterPublicId,
        type: 'SUPPORT_TICKET_UPDATED' as const,
        title: 'New Reply on Your Ticket',
        body: `Support replied to your ticket: "${ticket.subject}".`,
        data: { ticketPublicId },
      });
    }

    return message.toObject();
  }

  async deleteTicket(publicId: string): Promise<void> {
    await TicketModel.updateOne({ publicId }, { $set: { isDeleted: true } });
  }
}

export const supportService = new SupportService();
