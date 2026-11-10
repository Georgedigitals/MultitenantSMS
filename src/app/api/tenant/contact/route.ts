import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { findTenantBySlugOrDomain } from '@/lib/tenant';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenantSlug, fullName, email, phone, subject, message } = body;

    if (!fullName || !email || !message) {
      return NextResponse.json({ error: 'Name, email, and message are required' }, { status: 400 });
    }

    const tenant = typeof tenantSlug === 'string'
      ? await findTenantBySlugOrDomain(tenantSlug)
      : null;

    if (tenant) {
      await createNotification({
        tenantId: tenant.id,
        recipientType: 'school_admin',
        recipientId: tenant.id,
        type: 'contact_message',
        message: `Public Contact: ${fullName} (${email}${phone ? `, ${phone}` : ''}) - "${subject || 'General Inquiry'}": ${message}`,
        link: '/dashboard',
      }).catch((e: unknown) => console.warn('Contact notification creation warning:', e));
    }

    return NextResponse.json({ success: true, message: 'Message recorded' });
  } catch (err: any) {
    console.error('Contact form route error:', err);
    return NextResponse.json({ error: 'Failed to process contact message' }, { status: 500 });
  }
}
