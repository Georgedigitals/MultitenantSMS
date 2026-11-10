import prisma from './prisma';
import { NotificationRecipientType } from '@prisma/client';

export interface CreateNotificationInput {
  tenantId: string;
  recipientId: string;
  recipientType: NotificationRecipientType | 'school_admin' | 'staff' | 'parent' | 'student' | 'super_admin';
  type: string;
  message: string;
  link?: string;
}

export interface GetNotificationsInput {
  tenantId: string;
  recipientId: string;
  recipientRole?: string;
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}

function buildRecipientConditions(tenantId: string, recipientId: string, recipientRole?: string) {
  const conditions: any[] = [
    { recipientId },
    { recipientId: 'all' },
  ];

  if (recipientRole === 'school_admin') {
    conditions.push(
      { recipientId: 'school_admin_role' },
      { recipientId: 'school_admin' },
      { recipientId: tenantId },
      { recipientType: 'school_admin' }
    );
  } else if (recipientRole) {
    conditions.push({ recipientType: recipientRole });
  }

  return conditions;
}

/**
 * Creates a single notification for a tenant recipient.
 */
export async function createNotification(input: CreateNotificationInput) {
  return prisma.notification.create({
    data: {
      tenantId: input.tenantId,
      recipientId: input.recipientId,
      recipientType: input.recipientType as NotificationRecipientType,
      type: input.type,
      message: input.message,
      link: input.link,
    },
  });
}

/**
 * Bulk creates notifications (e.g. for all parents/students in a class).
 */
export async function createBulkNotifications(inputs: CreateNotificationInput[]) {
  if (inputs.length === 0) return { count: 0 };
  return prisma.notification.createMany({
    data: inputs.map((item) => ({
      tenantId: item.tenantId,
      recipientId: item.recipientId,
      recipientType: item.recipientType as NotificationRecipientType,
      type: item.type,
      message: item.message,
      link: item.link,
    })),
  });
}

/**
 * Super admin broadcast announcement. Creates per-tenant attributed notifications
 * for school admins across targeted (or all) active tenants.
 */
export async function createSuperAdminBroadcast(input: {
  message: string;
  link?: string;
  targetTenantIds?: string[];
}) {
  const tenantWhere = input.targetTenantIds?.length
    ? { id: { in: input.targetTenantIds }, status: 'active' as const }
    : { status: 'active' as const };

  const tenants = await prisma.tenant.findMany({
    where: tenantWhere,
    select: { id: true },
  });

  if (tenants.length === 0) return { count: 0 };

  const tenantIds = tenants.map((t: any) => t.id);

  const tenantAdmins = await prisma.tenantUser.findMany({
    where: {
      tenantId: { in: tenantIds },
      role: 'school_admin',
    },
    select: {
      id: true,
      tenantId: true,
    },
  });

  if (tenantAdmins.length === 0) return { count: 0 };

  const notificationData = tenantAdmins.map((admin: any) => ({
    tenantId: admin.tenantId,
    recipientId: admin.id,
    recipientType: 'school_admin' as NotificationRecipientType,
    type: 'platform_announcement',
    message: input.message,
    link: input.link,
  }));

  return prisma.notification.createMany({
    data: notificationData,
  });
}

/**
 * Retrieves paginated notifications and total unread count for a given recipient.
 */
export async function getNotifications(input: GetNotificationsInput) {
  const limit = input.limit ?? 20;
  const offset = input.offset ?? 0;
  const recipientConditions = buildRecipientConditions(input.tenantId, input.recipientId, input.recipientRole);

  const whereClause: any = {
    tenantId: input.tenantId,
    OR: recipientConditions,
  };

  if (input.unreadOnly) {
    whereClause.readAt = null;
  }

  // Execute sequentially to prevent connection thrashing on embedded PostgreSQL / PGlite
  const notifications = await prisma.notification.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  });

  const unreadCount = await prisma.notification.count({
    where: {
      tenantId: input.tenantId,
      readAt: null,
      OR: recipientConditions,
    },
  });

  // Optimize totalCount calculation when all items fit within the requested page
  let totalCount = notifications.length;
  if (offset > 0 || notifications.length === limit || input.unreadOnly) {
    totalCount = await prisma.notification.count({
      where: {
        tenantId: input.tenantId,
        OR: recipientConditions,
      },
    });
  }

  return {
    notifications,
    unreadCount,
    totalCount,
    limit,
    offset,
  };
}

/**
 * Marks a specific notification as read.
 */
export async function markNotificationAsRead(
  tenantId: string,
  recipientId: string,
  notificationId: string,
  recipientRole?: string
) {
  const recipientConditions = buildRecipientConditions(tenantId, recipientId, recipientRole);
  return prisma.notification.updateMany({
    where: {
      id: notificationId,
      tenantId,
      OR: recipientConditions,
    },
    data: {
      readAt: new Date(),
    },
  });
}

/**
 * Marks all unread notifications as read for a recipient.
 */
export async function markAllNotificationsAsRead(
  tenantId: string,
  recipientId: string,
  recipientRole?: string
) {
  const recipientConditions = buildRecipientConditions(tenantId, recipientId, recipientRole);
  return prisma.notification.updateMany({
    where: {
      tenantId,
      readAt: null,
      OR: recipientConditions,
    },
    data: {
      readAt: new Date(),
    },
  });
}
