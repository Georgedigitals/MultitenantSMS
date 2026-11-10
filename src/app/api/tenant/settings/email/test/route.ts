import { NextRequest, NextResponse } from 'next/server';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { dispatchEmail } from '@/lib/email-service';
import prisma from '@/lib/prisma';

/**
 * POST /api/tenant/settings/email/test
 * Sends a real-time test email to verify outbound email delivery for the school.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getTenantUserFromCookies();
    if (!auth || auth.user.role !== 'school_admin') {
      return NextResponse.json({ error: 'Unauthorized — Admin role required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const recipient = body.recipientEmail;

    if (!recipient) {
      return NextResponse.json({ error: 'Recipient email is required' }, { status: 400 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: auth.tenant.id },
      select: { name: true },
    });
    const schoolName = tenant?.name || 'School';

    const testResult = await dispatchEmail({
      to: recipient,
      subject: `Test Email from ${schoolName}`,
      html: `
        <div style="font-family: sans-serif; padding: 24px; background: #f8fafc; color: #0f172a; border-radius: 16px;">
          <h2 style="color: #2563eb; margin-top: 0;">SMTP Test Successful!</h2>
          <p>This is a test notification confirming that email dispatch is working properly for <strong>${schoolName}</strong>.</p>
          <p style="font-size: 13px; color: #64748b;">Timestamp: ${new Date().toISOString()}</p>
        </div>
      `,
      fromName: schoolName,
      tenantId: auth.tenant.id,
      replyTo: recipient,
    });

    return NextResponse.json({
      success: true,
      message: `Test email dispatched to ${recipient}`,
      deliveryId: testResult.id,
      simulated: testResult.simulated ?? false,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to send test email' }, { status: 500 });
  }
}
