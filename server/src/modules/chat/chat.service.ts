import { v4 as uuidv4 } from 'uuid';
import { ConversationModel, MessageModel } from './chat.model';
import type { IConversation, IMessage, SendMessageDto } from './chat.types';
import { TutorProfileModel } from '../tutors/tutor.model';
import { StudentProfileModel } from '../students/student.model';
import { PrincipalProfileModel } from '../principals/principal.model';
import { Role } from '../../constants/roles';
import type { PaginationQuery, PaginatedResult } from '../../shared/types';
import { parsePaginationQuery, buildPaginatedResult } from '../../utils/pagination';

// ─── Connection permission check ──────────────────────────────────────────────

async function isConnected(
  userAPublicId: string,
  roleA: string,
  userBPublicId: string,
  roleB: string,
): Promise<boolean> {
  const adminRoles: Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.SUPPORT];
  if (adminRoles.includes(roleA as Role) || adminRoles.includes(roleB as Role)) return true;

  const pair = new Set([`${roleA}:${roleB}`, `${roleB}:${roleA}`]);

  // TUTOR ↔ STUDENT: student.tutorPublicId must equal tutor profile's publicId
  if (pair.has('TUTOR:STUDENT')) {
    const [tutorId, studentId] = roleA === Role.TUTOR
      ? [userAPublicId, userBPublicId]
      : [userBPublicId, userAPublicId];

    const tutorProfile = await TutorProfileModel.findOne({ userPublicId: tutorId }).lean();
    if (!tutorProfile) return false;
    const studentProfile = await StudentProfileModel.findOne({ userPublicId: studentId }).lean();
    return !!(studentProfile && studentProfile.tutorPublicId === tutorProfile.publicId);
  }

  // PRINCIPAL ↔ TUTOR: tutor.principalPublicId must equal principal profile's publicId
  if (pair.has('PRINCIPAL:TUTOR')) {
    const [principalId, tutorId] = roleA === Role.PRINCIPAL
      ? [userAPublicId, userBPublicId]
      : [userBPublicId, userAPublicId];

    const principalProfile = await PrincipalProfileModel.findOne({ userPublicId: principalId }).lean();
    if (!principalProfile) return false;
    const tutorProfile = await TutorProfileModel.findOne({ userPublicId: tutorId }).lean();
    return !!(tutorProfile && tutorProfile.principalPublicId === principalProfile.publicId);
  }

  // PRINCIPAL ↔ STUDENT: student's tutor must be under this principal
  if (pair.has('PRINCIPAL:STUDENT')) {
    const [principalId, studentId] = roleA === Role.PRINCIPAL
      ? [userAPublicId, userBPublicId]
      : [userBPublicId, userAPublicId];

    const principalProfile = await PrincipalProfileModel.findOne({ userPublicId: principalId }).lean();
    if (!principalProfile) return false;
    const studentProfile = await StudentProfileModel.findOne({ userPublicId: studentId }).lean();
    if (!studentProfile) return false;
    const tutorProfile = await TutorProfileModel.findOne({ publicId: studentProfile.tutorPublicId }).lean();
    return !!(tutorProfile && tutorProfile.principalPublicId === principalProfile.publicId);
  }

  return false;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class ChatService {
  async getOrCreateConversation(
    userPublicId: string,
    userRole: string,
    recipientPublicId: string,
    recipientRole: string,
  ): Promise<IConversation> {
    const allowed = await isConnected(userPublicId, userRole, recipientPublicId, recipientRole);
    if (!allowed) {
      throw Object.assign(new Error('You are not connected to this person'), { statusCode: 403 });
    }

    // Canonical participant order so we can find existing conversation
    const [p1, p2] = [userPublicId, recipientPublicId].sort();
    const [r1, r2] = p1 === userPublicId
      ? [userRole, recipientRole]
      : [recipientRole, userRole];

    let conversation = await ConversationModel.findOne({
      participantPublicIds: { $all: [userPublicId, recipientPublicId] },
      isDeleted: false,
    }).lean();

    if (!conversation) {
      conversation = (await ConversationModel.create({
        publicId: uuidv4(),
        participantPublicIds: [p1, p2],
        participantRoles: [r1, r2],
        unreadCounts: { [p1]: 0, [p2]: 0 },
      })).toObject();
    }

    return conversation;
  }

  async getConversations(userPublicId: string): Promise<IConversation[]> {
    return ConversationModel.find({
      participantPublicIds: userPublicId,
      isDeleted: false,
    }).sort({ lastMessageAt: -1 }).lean();
  }

  async getMessages(
    conversationPublicId: string,
    userPublicId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResult<IMessage>> {
    const conversation = await ConversationModel.findOne({
      publicId: conversationPublicId,
      participantPublicIds: userPublicId,
      isDeleted: false,
    });
    if (!conversation) {
      throw Object.assign(new Error('Conversation not found'), { statusCode: 404 });
    }

    const { page, limit, skip } = parsePaginationQuery(query);
    const [items, total] = await Promise.all([
      MessageModel.find({ conversationPublicId, isDeleted: false })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      MessageModel.countDocuments({ conversationPublicId, isDeleted: false }),
    ]);

    return buildPaginatedResult(items.reverse(), total, page, limit);
  }

  async sendMessage(
    conversationPublicId: string,
    senderPublicId: string,
    dto: SendMessageDto,
  ): Promise<IMessage> {
    const conversation = await ConversationModel.findOne({
      publicId: conversationPublicId,
      participantPublicIds: senderPublicId,
      isDeleted: false,
    });
    if (!conversation) {
      throw Object.assign(new Error('Conversation not found'), { statusCode: 404 });
    }

    const message = await MessageModel.create({
      publicId: uuidv4(),
      conversationPublicId,
      senderPublicId,
      body: dto.body.trim(),
    });

    const recipientPublicId = conversation.participantPublicIds.find((id) => id !== senderPublicId)!;
    const unreadCounts = new Map(Object.entries(conversation.unreadCounts as Record<string, number>));
    unreadCounts.set(recipientPublicId, (unreadCounts.get(recipientPublicId) ?? 0) + 1);

    await ConversationModel.updateOne(
      { publicId: conversationPublicId },
      {
        $set: {
          lastMessageAt: new Date(),
          lastMessagePreview: dto.body.trim().slice(0, 80),
          unreadCounts: Object.fromEntries(unreadCounts),
        },
      },
    );

    return message.toObject();
  }

  async markRead(conversationPublicId: string, userPublicId: string): Promise<void> {
    const conversation = await ConversationModel.findOne({
      publicId: conversationPublicId,
      participantPublicIds: userPublicId,
    });
    if (!conversation) return;

    await MessageModel.updateMany(
      { conversationPublicId, senderPublicId: { $ne: userPublicId }, isRead: false },
      { $set: { isRead: true, readAt: new Date() } },
    );

    const unreadCounts = new Map(Object.entries(conversation.unreadCounts as Record<string, number>));
    unreadCounts.set(userPublicId, 0);
    await ConversationModel.updateOne(
      { publicId: conversationPublicId },
      { $set: { unreadCounts: Object.fromEntries(unreadCounts) } },
    );
  }

  async getTotalUnread(userPublicId: string): Promise<number> {
    const conversations = await ConversationModel.find({
      participantPublicIds: userPublicId,
      isDeleted: false,
    }).lean();

    return conversations.reduce((sum, c) => {
      const counts = c.unreadCounts as Record<string, number>;
      return sum + (counts[userPublicId] ?? 0);
    }, 0);
  }
}

export const chatService = new ChatService();
