import prisma from '@/lib/prisma';
import { TenantUserRole, ConversationType } from '@prisma/client';
import { AuthenticatedTenantUser } from '@/lib/auth/tenant-auth';

export interface RecipientOption {
  id: string; // TenantUser id
  name: string;
  role: TenantUserRole;
  roleLabel: string;
  subtitle?: string;
  avatarColor?: string;
}

export interface ConversationSummary {
  id: string;
  type: ConversationType;
  title: string | null;
  updatedAt: string;
  otherParticipant: {
    id: string;
    name: string;
    role: TenantUserRole;
    roleLabel: string;
    username: string;
  } | null;
  lastMessage: {
    id: string;
    content: string;
    senderId: string;
    senderName: string;
    createdAt: string;
  } | null;
  unreadCount: number;
}

export interface ThreadMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: TenantUserRole;
  content: string;
  createdAt: string;
  isMe: boolean;
}

/**
 * Resolves a human-readable display name and role label for a tenant user
 */
export function formatTenantUser(user: {
  id: string;
  username: string;
  role: TenantUserRole;
  staff?: { name: string; roleBase?: string } | null;
  student?: { name: string } | null;
}) {
  let name = user.username;
  let roleLabel = 'User';

  if (user.role === 'school_admin') {
    name = user.staff?.name || user.username || 'School Administrator';
    roleLabel = 'School Admin';
  } else if (user.role === 'teacher') {
    name = user.staff?.name || user.username;
    roleLabel = user.staff?.roleBase ? `Staff (${user.staff.roleBase})` : 'Teacher';
  } else if (user.role === 'student') {
    name = user.student?.name || user.username;
    roleLabel = 'Student';
  } else if (user.role === 'parent') {
    name = user.username;
    roleLabel = 'Parent / Guardian';
  }

  return { name, roleLabel };
}

/**
 * Enforces school safeguarding boundaries and queries eligible recipients
 */
export async function getEligibleRecipients(
  tenantId: string,
  currentUser: AuthenticatedTenantUser
): Promise<RecipientOption[]> {
  const { role, id: currentUserId, staffId, studentId } = currentUser;

  // 1. School Admin: Can message anyone in the school
  if (role === 'school_admin') {
    const allUsers = await prisma.tenantUser.findMany({
      where: {
        tenantId,
        id: { not: currentUserId },
        isActive: true,
      },
      include: {
        staff: { select: { name: true, roleBase: true } },
        student: { select: { name: true } },
      },
      orderBy: { username: 'asc' },
    });

    return allUsers.map((u: any) => {
      const { name, roleLabel } = formatTenantUser(u);
      return {
        id: u.id,
        name,
        role: u.role,
        roleLabel,
        subtitle: u.role === 'student' ? 'Student' : u.role === 'parent' ? 'Parent Portal' : u.staff?.roleBase || 'Staff',
      };
    });
  }

  // 2. Teacher: Can message Admins, other Teachers/Staff, and Parents/Students linked to their classes
  if (role === 'teacher') {
    // Teachers & Admins
    const staffAndAdmins = await prisma.tenantUser.findMany({
      where: {
        tenantId,
        id: { not: currentUserId },
        isActive: true,
        role: { in: ['school_admin', 'teacher'] },
      },
      include: {
        staff: { select: { name: true, roleBase: true } },
      },
    });

    // Determine teacher's assigned classes or subjects if staffId exists
    let studentIds: string[] = [];
    if (staffId) {
      const assignments = await prisma.teachingAssignment.findMany({
        where: { staffId },
        select: { classLevelId: true },
      });

      const formAssignments = await prisma.formTeacherAssignment.findMany({
        where: { staffId },
        select: { classLevelId: true },
      });

      const classLevelIds = Array.from(
        new Set([
          ...assignments.map((a: any) => a.classLevelId),
          ...formAssignments.map((f: any) => f.classLevelId),
        ])
      );

      if (classLevelIds.length > 0) {
        const enrollments = await prisma.enrollment.findMany({
          where: {
            classLevelId: { in: classLevelIds },
            status: 'active',
          },
          select: { studentId: true },
        });
        studentIds = Array.from(new Set(enrollments.map((e: any) => e.studentId)));
      }
    }

    // Query enrolled students
    const studentUsers = studentIds.length > 0
      ? await prisma.tenantUser.findMany({
          where: {
            tenantId,
            isActive: true,
            role: 'student',
            studentId: { in: studentIds },
          },
          include: {
            student: { select: { name: true } },
          },
        })
      : [];

    // Query parent users
    const parentUsers = await prisma.tenantUser.findMany({
      where: {
        tenantId,
        isActive: true,
        role: 'parent',
      },
    });

    const results: RecipientOption[] = [];

    // Add Staff & Admins
    for (const u of staffAndAdmins) {
      const { name, roleLabel } = formatTenantUser(u);
      results.push({
        id: u.id,
        name,
        role: u.role,
        roleLabel,
        subtitle: u.role === 'school_admin' ? 'Administration' : 'Faculty Colleague',
      });
    }

    // Add Students
    for (const u of studentUsers) {
      const { name, roleLabel } = formatTenantUser(u);
      results.push({
        id: u.id,
        name,
        role: u.role,
        roleLabel,
        subtitle: 'Enrolled Student',
      });
    }

    // Add Parents
    for (const u of parentUsers) {
      const { name, roleLabel } = formatTenantUser(u);
      results.push({
        id: u.id,
        name,
        role: u.role,
        roleLabel,
        subtitle: 'Guardian / Parent',
      });
    }

    return results;
  }

  // 3. Parent: Can message School Admins & Teachers. Cannot message other parents or students.
  if (role === 'parent') {
    const staffAndAdmins = await prisma.tenantUser.findMany({
      where: {
        tenantId,
        isActive: true,
        role: { in: ['school_admin', 'teacher'] },
      },
      include: {
        staff: { select: { name: true, roleBase: true } },
      },
    });

    return staffAndAdmins.map((u: any) => {
      const { name, roleLabel } = formatTenantUser(u);
      return {
        id: u.id,
        name,
        role: u.role,
        roleLabel,
        subtitle: u.role === 'school_admin' ? 'School Administration' : 'Subject / Form Teacher',
      };
    });
  }

  // 4. Student: Can message School Admins & Teachers for academic Q&A. Student-Student chat is blocked.
  if (role === 'student') {
    const staffAndAdmins = await prisma.tenantUser.findMany({
      where: {
        tenantId,
        isActive: true,
        role: { in: ['school_admin', 'teacher'] },
      },
      include: {
        staff: { select: { name: true, roleBase: true } },
      },
    });

    return staffAndAdmins.map((u: any) => {
      const { name, roleLabel } = formatTenantUser(u);
      return {
        id: u.id,
        name,
        role: u.role,
        roleLabel,
        subtitle: u.role === 'school_admin' ? 'Helpdesk & Administration' : 'Teacher / Coursework Advice',
      };
    });
  }

  return [];
}

/**
 * Verifies if communication between sender and recipient is allowed by school safeguarding rules
 */
export async function canCommunicate(
  tenantId: string,
  senderUser: AuthenticatedTenantUser,
  recipientUserId: string
): Promise<{ allowed: boolean; reason?: string }> {
  if (senderUser.id === recipientUserId) {
    return { allowed: false, reason: 'Cannot message yourself' };
  }

  const recipient = await prisma.tenantUser.findUnique({
    where: { id: recipientUserId },
    select: { id: true, tenantId: true, role: true, isActive: true },
  });

  if (!recipient || recipient.tenantId !== tenantId || !recipient.isActive) {
    return { allowed: false, reason: 'Recipient not found in this school instance' };
  }

  // Student <-> Student Chat is STRICTLY BLOCKED to prevent bullying liability and distraction
  if (senderUser.role === 'student' && recipient.role === 'student') {
    return { allowed: false, reason: 'Direct student-to-student messaging is disabled by school policy' };
  }

  // Parent <-> Parent Chat is blocked
  if (senderUser.role === 'parent' && recipient.role === 'parent') {
    return { allowed: false, reason: 'Direct parent-to-parent messaging is disabled' };
  }

  // Parent <-> Student Chat is blocked (must go via guardian offline channels or administration)
  if (
    (senderUser.role === 'parent' && recipient.role === 'student') ||
    (senderUser.role === 'student' && recipient.role === 'parent')
  ) {
    return { allowed: false, reason: 'Direct messaging between parents and general students is disabled' };
  }

  return { allowed: true };
}

/**
 * Fetch all conversations for the authenticated user with unread counts and latest snippet
 */
export async function getUserConversations(
  tenantId: string,
  userId: string
): Promise<ConversationSummary[]> {
  const participantRecords = await prisma.conversationParticipant.findMany({
    where: {
      userId,
      conversation: { tenantId },
    },
    include: {
      conversation: {
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  role: true,
                  staff: { select: { name: true, roleBase: true } },
                  student: { select: { name: true } },
                },
              },
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              sender: {
                select: {
                  id: true,
                  username: true,
                  role: true,
                  staff: { select: { name: true } },
                  student: { select: { name: true } },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { conversation: { updatedAt: 'desc' } },
  });

  const summaries: ConversationSummary[] = [];

  for (const record of participantRecords) {
    const conv = record.conversation;
    const lastMsg = conv.messages[0] || null;

    // Find other participant (for 1:1 direct conversations)
    const otherPart = conv.participants.find((p: any) => p.userId !== userId);
    let otherParticipant = null;

    if (otherPart?.user) {
      const { name, roleLabel } = formatTenantUser(otherPart.user);
      otherParticipant = {
        id: otherPart.user.id,
        name,
        role: otherPart.user.role,
        roleLabel,
        username: otherPart.user.username,
      };
    }

    // Count unread messages (messages created after lastReadAt and not sent by current user)
    const unreadCount = await prisma.message.count({
      where: {
        conversationId: conv.id,
        senderId: { not: userId },
        ...(record.lastReadAt ? { createdAt: { gt: record.lastReadAt } } : {}),
      },
    });

    let formattedLastMsg = null;
    if (lastMsg) {
      const { name } = formatTenantUser(lastMsg.sender);
      formattedLastMsg = {
        id: lastMsg.id,
        content: lastMsg.content,
        senderId: lastMsg.senderId,
        senderName: name,
        createdAt: lastMsg.createdAt.toISOString(),
      };
    }

    summaries.push({
      id: conv.id,
      type: conv.type,
      title: conv.title,
      updatedAt: conv.updatedAt.toISOString(),
      otherParticipant,
      lastMessage: formattedLastMsg,
      unreadCount,
    });
  }

  return summaries;
}

/**
 * Gets conversation thread messages and automatically updates the user's lastReadAt
 */
export async function getConversationThread(
  tenantId: string,
  conversationId: string,
  userId: string,
  limit = 100
): Promise<{
  conversation: { id: string; type: ConversationType; title: string | null };
  otherUser: { id: string; name: string; role: TenantUserRole; roleLabel: string } | null;
  messages: ThreadMessage[];
}> {
  // Ensure the user is a participant of this conversation
  const participant = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: { conversationId, userId },
    },
    include: {
      conversation: {
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  role: true,
                  staff: { select: { name: true } },
                  student: { select: { name: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!participant || participant.conversation.tenantId !== tenantId) {
    throw new Error('Conversation not found or access denied');
  }

  // Update participant lastReadAt
  await prisma.conversationParticipant.update({
    where: { id: participant.id },
    data: { lastReadAt: new Date() },
  });

  const rawMessages = await prisma.message.findMany({
    where: { conversationId, tenantId },
    orderBy: { createdAt: 'asc' },
    take: limit,
    include: {
      sender: {
        select: {
          id: true,
          username: true,
          role: true,
          staff: { select: { name: true } },
          student: { select: { name: true } },
        },
      },
    },
  });

  const otherPart = participant.conversation.participants.find((p: any) => p.userId !== userId);
  let otherUser = null;
  if (otherPart?.user) {
    const { name, roleLabel } = formatTenantUser(otherPart.user);
    otherUser = {
      id: otherPart.user.id,
      name,
      role: otherPart.user.role,
      roleLabel,
    };
  }

  const messages: ThreadMessage[] = rawMessages.map((m: any) => {
    const { name } = formatTenantUser(m.sender);
    return {
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      senderName: name,
      senderRole: m.sender.role,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
      isMe: m.senderId === userId,
    };
  });

  return {
    conversation: {
      id: participant.conversation.id,
      type: participant.conversation.type,
      title: participant.conversation.title,
    },
    otherUser,
    messages,
  };
}

/**
 * Creates or gets an existing 1:1 direct conversation between two users
 */
export async function getOrCreateDirectConversation(
  tenantId: string,
  user1Id: string,
  user2Id: string
): Promise<string> {
  // Look for an existing conversation where both are participants
  const existing = await prisma.conversation.findFirst({
    where: {
      tenantId,
      type: 'direct',
      AND: [
        { participants: { some: { userId: user1Id } } },
        { participants: { some: { userId: user2Id } } },
      ],
    },
    select: { id: true },
  });

  if (existing) {
    return existing.id;
  }

  // Create new conversation in a transaction
  return await prisma.$transaction(async (tx: any) => {
    const newConv = await tx.conversation.create({
      data: {
        tenantId,
        type: 'direct',
      },
    });

    await tx.conversationParticipant.createMany({
      data: [
        { conversationId: newConv.id, userId: user1Id, lastReadAt: new Date() },
        { conversationId: newConv.id, userId: user2Id },
      ],
    });

    return newConv.id;
  });
}

/**
 * Post a new message to a conversation thread
 */
export async function postMessage(
  tenantId: string,
  userId: string,
  conversationId: string,
  content: string
): Promise<ThreadMessage> {
  const cleanContent = content.trim();
  if (!cleanContent) {
    throw new Error('Message content cannot be empty');
  }

  // Verify participant
  const participant = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: { conversationId, userId },
    },
    include: {
      conversation: true,
      user: {
        select: {
          id: true,
          username: true,
          role: true,
          staff: { select: { name: true } },
          student: { select: { name: true } },
        },
      },
    },
  });

  if (!participant || participant.conversation.tenantId !== tenantId) {
    throw new Error('Unauthorized or conversation not found');
  }

  const now = new Date();

  return await prisma.$transaction(async (tx: any) => {
    // 1. Create message
    const msg = await tx.message.create({
      data: {
        conversationId,
        tenantId,
        senderId: userId,
        content: cleanContent,
        createdAt: now,
      },
      include: {
        sender: {
          select: {
            username: true,
            role: true,
            staff: { select: { name: true } },
            student: { select: { name: true } },
          },
        },
      },
    });

    // 2. Touch conversation updatedAt
    await tx.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: now },
    });

    // 3. Update sender's lastReadAt
    await tx.conversationParticipant.update({
      where: { id: participant.id },
      data: { lastReadAt: now },
    });

    const { name } = formatTenantUser(msg.sender);

    return {
      id: msg.id,
      conversationId: msg.conversationId,
      senderId: msg.senderId,
      senderName: name,
      senderRole: msg.sender.role,
      content: msg.content,
      createdAt: msg.createdAt.toISOString(),
      isMe: true,
    };
  });
}
