import { NextRequest, NextResponse } from 'next/server';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { getConversationThread, postMessage } from '@/lib/messages';
import prisma from '@/lib/prisma';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const auth = await getTenantUserFromCookies();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: conversationId } = await params;

    const thread = await getConversationThread(
      auth.user.tenantId,
      conversationId,
      auth.user.id
    );

    return NextResponse.json(thread);
  } catch (err: any) {
    console.error('[API /api/tenant/messages/[id] GET error]', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch conversation thread' },
      { status: 404 }
    );
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const auth = await getTenantUserFromCookies();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: conversationId } = await params;
    const body = await req.json();
    const { content } = body;

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: 'Message content cannot be empty' },
        { status: 400 }
      );
    }

    const message = await postMessage(
      auth.user.tenantId,
      auth.user.id,
      conversationId,
      content
    );

    return NextResponse.json({ message });
  } catch (err: any) {
    console.error('[API /api/tenant/messages/[id] POST error]', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to post message' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const auth = await getTenantUserFromCookies();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: conversationId } = await params;

    await prisma.conversationParticipant.updateMany({
      where: {
        conversationId,
        userId: auth.user.id,
      },
      data: {
        lastReadAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[API /api/tenant/messages/[id] PATCH error]', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to mark as read' },
      { status: 500 }
    );
  }
}
