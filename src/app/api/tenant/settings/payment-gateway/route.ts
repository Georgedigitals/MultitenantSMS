import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess } from '@/lib/auth/tenant-access';
import { decryptTenantSecret, encryptTenantSecret, paystackKeyMode } from '@/lib/tenant-payments';
import prisma from '@/lib/prisma';

function slugFrom(req: NextRequest) {
  return req.nextUrl.searchParams.get('slug') || req.headers.get('x-tenant-slug') || '';
}

export async function GET(req: NextRequest) {
  const access = await requireTenantAccess(slugFrom(req), ['school_admin']);
  if (!access.authorized || !access.tenant) return NextResponse.json({ error: access.error || 'Unauthorized' }, { status: access.statusCode || 401 });
  // Load credentials by the verified tenant ID; the secret never leaves the server.
  const config = await prisma.tenantPaymentGateway.findUnique({ where: { tenantId: access.tenant.id } });
  let mode: 'test' | 'live' | null = null;
  if (config) {
    try { mode = paystackKeyMode(decryptTenantSecret(config.paystackSecretCipher)); } catch { mode = null; }
  }
  const tenant = await prisma.tenant.findUnique({ where: { id: access.tenant.id }, select: { hasOnlinePayment: true, hasOnlinePinPayment: true } });
  return NextResponse.json({
    configured: Boolean(config), enabled: Boolean(config?.enabled && tenant?.hasOnlinePayment),
    pinSalesEnabled: Boolean(config?.enabled && tenant?.hasOnlinePinPayment), mode,
  });
}

export async function PUT(req: NextRequest) {
  const access = await requireTenantAccess(slugFrom(req), ['school_admin']);
  if (!access.authorized || !access.tenant) return NextResponse.json({ error: access.error || 'Unauthorized' }, { status: access.statusCode || 401 });
  try {
    const body = await req.json();
    const secretKey = typeof body.secretKey === 'string' ? body.secretKey.trim() : '';
    const enabled = body.enabled === true;
    const tenantSettings = await prisma.tenant.findUnique({ where: { id: access.tenant.id }, select: { hasOnlinePinPayment: true } });
    const pinSalesEnabled = body.pinSalesEnabled === undefined ? Boolean(tenantSettings?.hasOnlinePinPayment) : body.pinSalesEnabled === true;
    const gatewayEnabled = enabled || pinSalesEnabled;
    const existing = await prisma.tenantPaymentGateway.findUnique({ where: { tenantId: access.tenant.id } });
    const effectiveSecret = secretKey || (existing ? decryptTenantSecret(existing.paystackSecretCipher) : '');
    const mode = effectiveSecret ? paystackKeyMode(effectiveSecret) : null;
    if (secretKey && (!mode || secretKey.length > 256)) {
      return NextResponse.json({ error: 'Enter a valid Paystack secret key (test or live). The secret stays private to this school.' }, { status: 400 });
    }
    if (gatewayEnabled && !mode) return NextResponse.json({ error: 'Add a valid Paystack secret key before enabling online payments.' }, { status: 400 });
    const encrypted = secretKey ? encryptTenantSecret(secretKey) : existing?.paystackSecretCipher;
    if (!encrypted) {
      if (!enabled) {
        await prisma.tenant.update({ where: { id: access.tenant.id }, data: { hasOnlinePayment: false, hasOnlinePinPayment: false } });
        return NextResponse.json({ success: true, configured: false, enabled: false, pinSalesEnabled: false, mode: null });
      }
      return NextResponse.json({ error: 'A Paystack secret key is required.' }, { status: 400 });
    }
    const config = await prisma.$transaction(async (tx) => {
      const saved = await tx.tenantPaymentGateway.upsert({
        where: { tenantId: access.tenant!.id },
        create: { tenantId: access.tenant!.id, paystackSecretCipher: encrypted, enabled: gatewayEnabled },
        update: { paystackSecretCipher: encrypted, enabled: gatewayEnabled },
        select: { enabled: true },
      });
      await tx.tenant.update({ where: { id: access.tenant!.id }, data: { hasOnlinePayment: enabled, hasOnlinePinPayment: pinSalesEnabled } });
      return saved;
    });
    return NextResponse.json({ success: true, configured: true, enabled, pinSalesEnabled, mode });
  } catch (error) {
    console.error('[Tenant Paystack settings] Could not save gateway configuration');
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not save payment settings.' }, { status: 503 });
  }
}
