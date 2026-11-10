import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTenantAccess } from '@/lib/auth/tenant-access';
import { sendWhatsAppTemplate } from '@/lib/whatsapp-service';
import { formatNigerianPhoneNumber } from '@/lib/sms-service';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');

  if (!slug) {
    return NextResponse.json({ error: 'Missing tenant slug' }, { status: 400 });
  }

  const access = await requireTenantAccess(slug, ['school_admin']);
  if (!access.authorized || !access.tenant) {
    return NextResponse.json({ error: 'Unauthorized access' }, { status: 403 });
  }

  const hasFeature = await access.tenant.hasFeature('feature_whatsapp_alerts');
  if (!hasFeature) {
    return NextResponse.json(
      { error: 'WhatsApp Alerts module is not enabled for your subscription plan' },
      { status: 403 }
    );
  }

  const logs = await prisma.whatsAppLog.findMany({
    where: { tenantId: access.tenant.id },
    orderBy: { sentAt: 'desc' },
    take: 50,
  });

  return NextResponse.json({ logs, hasFeature: true });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { slug, phone, template, payload } = body;

    if (!slug || !phone || !template) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const access = await requireTenantAccess(slug, ['school_admin', 'teacher']);
    if (!access.authorized || !access.tenant) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 403 });
    }

    const hasFeature = await access.tenant.hasFeature('feature_whatsapp_alerts');
    if (!hasFeature) {
      return NextResponse.json({ error: 'WhatsApp Alerts module disabled' }, { status: 403 });
    }

    if (typeof phone !== 'string' || typeof template !== 'string' || !/^[a-z0-9_]{2,128}$/.test(template)) {
      return NextResponse.json({ error: 'Enter a valid phone number and Meta-approved template name.' }, { status: 400 });
    }
    const normalizedPhone = formatNigerianPhoneNumber(phone);
    const parameters = Array.isArray(payload?.parameters)
      ? payload.parameters.filter((value: unknown): value is string => typeof value === 'string').slice(0, 10)
      : [];
    if (!/^\d{10,15}$/.test(normalizedPhone) || (Array.isArray(payload?.parameters) && parameters.length !== payload.parameters.length)) {
      return NextResponse.json({ error: 'Phone number or template parameters are invalid.' }, { status: 400 });
    }

    const delivery = await sendWhatsAppTemplate({ phone: normalizedPhone, template, parameters });
    const log = await prisma.whatsAppLog.create({
      data: {
        tenantId: access.tenant.id,
        phone: normalizedPhone,
        template,
        payload: { parameters },
        status: delivery.success ? 'sent' : (delivery.error?.includes('not configured') ? 'not_configured' : 'failed'),
      },
    });
    if (!delivery.success) {
      return NextResponse.json({ success: false, error: delivery.error, log }, { status: delivery.error?.includes('not configured') ? 503 : 502 });
    }
    return NextResponse.json({ success: true, log, providerMessageId: delivery.providerMessageId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to dispatch WhatsApp message' }, { status: 500 });
  }
}
