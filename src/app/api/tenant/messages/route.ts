import { NextRequest, NextResponse } from 'next/server';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import {
  getUserConversations,
  getEligibleRecipients,
  getOrCreateDirectConversation,
  postMessage,
  canCommunicate,
} from '@/lib/messages';

export async function GET(req: NextRequest) {
  try {
    const auth = await getTenantUserFromCookies();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode');

    // If query is for eligible contacts
    if (mode === 'recipients') {
      const recipients = await getEligibleRecipients(auth.user.tenantId, auth.user);
      return NextResponse.json({ recipients });
    }

    // Default: fetch conversations for current user
    const conversations = await getUserConversations(auth.user.tenantId, auth.user.id);
    return NextResponse.json({ conversations });
  } catch (err: any) {
    console.error('[API /api/tenant/messages GET error]', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getTenantUserFromCookies();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { recipientId, content } = body;

    if (!recipientId || !content || !content.trim()) {
      return NextResponse.json(
        { error: 'Recipient and message content are required' },
        { status: 400 }
      );
    }

    // Verify school safeguarding communication policy
    const check = await canCommunicate(auth.user.tenantId, auth.user, recipientId);
    if (!check.allowed) {
      return NextResponse.json(
        { error: check.reason || 'Communication not allowed' },
        { status: 403 }
      );
    }

    // Find or create direct conversation thread
    const conversationId = await getOrCreateDirectConversation(
      auth.user.tenantId,
      auth.user.id,
      recipientId
    );

    // Post message
    const message = await postMessage(
      auth.user.tenantId,
      auth.user.id,
      conversationId,
      content
    );

    return NextResponse.json({ conversationId, message });
  } catch (err: any) {
    console.error('[API /api/tenant/messages POST error]', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to send message' },
      { status: 500 }
    );
  }
}
