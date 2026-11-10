import { NextRequest, NextResponse } from 'next/server';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '@/lib/notifications';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { tenantHasFeature } from '@/lib/features';

async function getSession() {
  const auth = await getTenantUserFromCookies(undefined, undefined, { allowExpiredTrial: true });
  if (!auth) return null;
  return { tenantId: auth.user.tenantId, userId: auth.user.id, role: auth.user.role };
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', notifications: [], unreadCount: 0, totalCount: 0 },
        { status: 401 }
      );
    }

    // School admin always receives in-app notifications for school operational alerts;
    // other roles check the plan's 'notifications' feature
    if (session.role !== 'school_admin' && !(await tenantHasFeature(session.tenantId, 'notifications'))) {
      return NextResponse.json(
        { error: 'In-app notifications are not enabled for this school.', notifications: [], unreadCount: 0, totalCount: 0 },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const data = await getNotifications({
      tenantId: session.tenantId,
      recipientId: session.userId,
      recipientRole: session.role,
      unreadOnly,
      limit,
      offset,
    });

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message || 'Failed to fetch notifications',
        notifications: [],
        unreadCount: 0,
        totalCount: 0,
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'school_admin' && !(await tenantHasFeature(session.tenantId, 'notifications'))) {
      return NextResponse.json({ error: 'In-app notifications are not enabled for this school.' }, { status: 403 });
    }

    const body = await req.json();
    const { action, notificationId } = body;

    if (action === 'read_one') {
      if (!notificationId) {
        return NextResponse.json({ error: 'notificationId is required' }, { status: 400 });
      }
      await markNotificationAsRead(session.tenantId, session.userId, notificationId, session.role);
      return NextResponse.json({ success: true, notificationId });
    }

    if (action === 'read_all') {
      await markAllNotificationsAsRead(session.tenantId, session.userId, session.role);
      return NextResponse.json({ success: true, allRead: true });
    }

    return NextResponse.json({ error: 'Invalid action. Must be read_one or read_all' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update notification status' },
      { status: 400 }
    );
  }
}
