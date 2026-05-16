import { v4 as uuidv4 } from 'uuid';
import { ConversationModel, MessageModel } from './chat.model';
import type { IConversation, IMessage, SendMessageDto } from './chat.types';
import { TutorProfileModel } from '../tutors/tutor.model';
import { StudentProfileModel } from '../students/student.model';
import { PrincipalProfileModel } from '../principals/principal.model';
import { ParentProfileModel } from '../parents/parent.model';
import { userRepository } from '../users/user.repository';
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

  // PARENT ↔ TUTOR: parent must have at least one child assigned to this tutor
  if (pair.has('PARENT:TUTOR')) {
    const [parentId, tutorId] = roleA === Role.PARENT
      ? [userAPublicId, userBPublicId]
      : [userBPublicId, userAPublicId];

    const tutorProfile = await TutorProfileModel.findOne({ userPublicId: tutorId }).lean();
    if (!tutorProfile) return false;
    const parentProfile = await ParentProfileModel.findOne({ userPublicId: parentId }).lean();
    if (!parentProfile || parentProfile.childStudentPublicIds.length === 0) return false;
    const linked = await StudentProfileModel.findOne({
      publicId: { $in: parentProfile.childStudentPublicIds },
      tutorPublicId: tutorProfile.publicId,
    }).lean();
    return !!linked;
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

  async getConversations(userPublicId: string): Promise<Array<IConversation & { participantNames: string[] }>> {
    const convos = await ConversationModel.find({
      participantPublicIds: userPublicId,
      isDeleted: false,
    }).sort({ lastMessageAt: -1 }).lean();

    if (convos.length === 0) return [];

    const allIds = [...new Set(convos.flatMap((c) => c.participantPublicIds as string[]))];
    const users = await userRepository.findManyByPublicIds(allIds);
    const nameMap = new Map(users.map((u) => [u.publicId, `${u.firstName} ${u.lastName}`.trim()]));

    return convos.map((c) => ({
      ...c,
      participantNames: (c.participantPublicIds as string[]).map((id) => nameMap.get(id) ?? 'Unknown'),
    }));
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
    const body = dto.body?.trim() ?? '';
    if (!body && !dto.mediaPublicId) {
      throw Object.assign(new Error('Message must have text or an attachment'), { statusCode: 400 });
    }

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
      body,
      ...(dto.mediaPublicId && {
        mediaPublicId: dto.mediaPublicId,
        mediaMimeType: dto.mediaMimeType,
        mediaName: dto.mediaName,
        mediaSizeBytes: dto.mediaSizeBytes,
      }),
    });

    const recipientPublicId = conversation.participantPublicIds.find((id) => id !== senderPublicId)!;

    let preview = body.slice(0, 80);
    if (!preview && dto.mediaName) preview = `📎 ${dto.mediaName}`;

    await ConversationModel.updateOne(
      { publicId: conversationPublicId },
      {
        $set: { lastMessageAt: new Date(), lastMessagePreview: preview },
        $inc: { [`unreadCounts.${recipientPublicId}`]: 1 },
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

    await ConversationModel.updateOne(
      { publicId: conversationPublicId },
      { $set: { [`unreadCounts.${userPublicId}`]: 0 } },
    );
  }

  async getTotalUnread(userPublicId: string): Promise<number> {
    const conversations = await ConversationModel.find({
      participantPublicIds: userPublicId,
      isDeleted: false,
    });

    return conversations.reduce((sum, c) => {
      const val = (c.unreadCounts as unknown as Map<string, number>).get(userPublicId) ?? 0;
      return sum + val;
    }, 0);
  }
}

export const chatService = new ChatService();
