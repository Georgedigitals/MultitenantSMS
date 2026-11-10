import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getTenantContext } from '@/lib/tenant';
import { prisma } from '@/lib/prisma';
import { getTenantPaystackSecret } from '@/lib/tenant-payments';
import { fulfillPinStockSale } from '@/lib/pin';

async function resolveExpiredReservations(tenantId: string, secret: string) {
  const expired = await prisma.generatedPin.findMany({
    where: { tenantId, soldAt: null, onlineSaleReference: { not: null }, reservedUntil: { lte: new Date() } },
    select: { id: true, onlineSaleReference: true },
    take: 25,
  });
  for (const pin of expired) {
    const reference = pin.onlineSaleReference;
    if (!reference) continue;
    const intent = await prisma.paymentIntent.findFirst({ where: { reference, tenantId, purpose: 'result_pin' } });
    if (!intent) {
      await prisma.generatedPin.updateMany({ where: { id: pin.id, tenantId, onlineSaleReference: reference, soldAt: null }, data: { studentId: null, termId: null, onlineSaleReference: null, reservedUntil: null } });
      continue;
    }
    if (intent.status === 'failed') {
      await prisma.generatedPin.updateMany({ where: { id: pin.id, tenantId, onlineSaleReference: reference, soldAt: null }, data: { studentId: null, termId: null, onlineSaleReference: null, reservedUntil: null } });
      continue;
    }
    if (intent.status !== 'initialized') continue;

    let verified: any;
    try {
      const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${secret}` }, cache: 'no-store', signal: AbortSignal.timeout(8_000),
      });
      verified = response.ok ? await response.json() : null;
    } catch { continue; }
    const transaction = verified?.data;
    if (verified?.status && transaction?.status === 'success' && transaction.reference === reference && transaction.currency === 'NGN') {
      try {
        await fulfillPinStockSale({
          reference, tenantId, amountPaid: Number(transaction.amount) / 100,
          metadata: { tenantId, studentId: intent.studentId, termId: intent.termId },
        });
      } catch { /* Keep the reservation until the payment can be reconciled safely. */ }
    } else if (verified?.status && ['failed', 'abandoned'].includes(transaction?.status)) {
      await prisma.$transaction(async (tx) => {
        await tx.paymentIntent.updateMany({ where: { id: intent.id, status: 'initialized' }, data: { status: 'failed' } });
        await tx.generatedPin.updateMany({ where: { id: pin.id, tenantId, onlineSaleReference: reference, soldAt: null }, data: { studentId: null, termId: null, onlineSaleReference: null, reservedUntil: null } });
      });
    }
  }
}

export async function GET(req: NextRequest) {
  try {
    const slug = req.headers.get('x-tenant-slug') || req.nextUrl.searchParams.get('slug') || undefined;
    const reference = req.nextUrl.searchParams.get('ref');
    const tenant = await getTenantContext({ slug });
    if (!tenant) return NextResponse.json({ error: 'School not found.' }, { status: 404 });
    if (!tenant.hasFeature('result_pins')) return NextResponse.json({ error: 'Result PINs are not enabled for this school.' }, { status: 403 });

    if (!reference) {
      const stock = await prisma.generatedPin.findFirst({
        where: { tenantId: tenant.id, studentId: null, soldAt: null, isUsed: false, onlineSaleReference: null, batch: { status: 'completed' } },
        include: { batch: { select: { pricePerPin: true } } },
        orderBy: { createdAt: 'asc' },
      });
      const availableCount = await prisma.generatedPin.count({
        where: { tenantId: tenant.id, studentId: null, soldAt: null, isUsed: false, onlineSaleReference: null, batch: { status: 'completed' } },
      });
      const [gateway, settings] = await Promise.all([
        prisma.tenantPaymentGateway.findUnique({ where: { tenantId: tenant.id }, select: { enabled: true } }),
        prisma.tenant.findUnique({ where: { id: tenant.id }, select: { hasOnlinePinPayment: true } }),
      ]);
      return NextResponse.json({
        available: Boolean(stock), availableCount,
        price: stock ? Number(stock.batch.pricePerPin) : null,
        onlinePaymentEnabled: Boolean(gateway?.enabled && settings?.hasOnlinePinPayment),
      });
    }

    const pin = await prisma.generatedPin.findFirst({
      where: { onlineSaleReference: reference, tenantId: tenant.id, soldAt: { not: null } },
      include: {
        student: { select: { id: true, name: true } },
        batch: { select: { pricePerPin: true } },
      },
    });
    if (pin) {
      return NextResponse.json({
        success: true,
        pin: {
          id: pin.id, code: pin.pinCode, serialNumber: pin.serialNumber, status: pin.isUsed ? 'active' : 'unused',
          studentId: pin.studentId, studentName: pin.student?.name, termId: pin.termId,
          pricePaid: Number(pin.batch.pricePerPin), paymentRef: reference, createdAt: pin.soldAt,
        },
      });
    }

    const pending = await prisma.paymentIntent.findFirst({ where: { reference, tenantId: tenant.id, purpose: 'result_pin' } });
    if (pending) return NextResponse.json({ error: 'Payment is still being confirmed. Please try again shortly.' }, { status: 409 });
    return NextResponse.json({ error: 'PIN purchase was not found for this school.' }, { status: 404 });
  } catch {
    return NextResponse.json({ error: 'Could not retrieve Result PIN information.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let tenantId: string | null = null;
  let reference: string | null = null;
  try {
    const slug = req.headers.get('x-tenant-slug') || req.nextUrl.searchParams.get('slug') || undefined;
    const tenant = await getTenantContext({ slug });
    if (!tenant) return NextResponse.json({ error: 'School not found.' }, { status: 404 });
    if (!tenant.hasFeature('result_pins')) return NextResponse.json({ error: 'Result PINs are not enabled for this school.' }, { status: 403 });
    tenantId = tenant.id;

    const body = await req.json();
    const studentIdentifier = typeof body.studentId === 'string' ? body.studentId.trim() : '';
    const termId = typeof body.termId === 'string' ? body.termId : '';
    const customerEmail = typeof body.customerEmail === 'string' ? body.customerEmail.trim().toLowerCase() : '';
    if (!studentIdentifier || !termId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      return NextResponse.json({ error: 'A valid student, academic term, and email are required to buy a Result PIN.' }, { status: 400 });
    }

    const [student, term, tenantSettings, secret] = await Promise.all([
      prisma.student.findFirst({
        where: { tenantId: tenant.id, OR: [{ id: studentIdentifier }, { admissionNumber: studentIdentifier }] },
        select: { id: true },
      }),
      prisma.term.findFirst({ where: { id: termId, session: { tenantId: tenant.id } }, select: { id: true } }),
      prisma.tenant.findUnique({ where: { id: tenant.id }, select: { hasOnlinePinPayment: true } }),
      getTenantPaystackSecret(tenant.id),
    ]);
    if (!student || !term) return NextResponse.json({ error: 'Student or academic term was not found for this school.' }, { status: 404 });
    if (!secret || !tenantSettings?.hasOnlinePinPayment) {
      return NextResponse.json({ error: 'This school has not enabled online Result PIN payments.' }, { status: 409 });
    }
    await resolveExpiredReservations(tenant.id, secret);

    const paymentReference = `RPIN_${randomUUID().replace(/-/g, '')}`;
    reference = paymentReference;
    const intent = await prisma.$transaction(async (tx) => {
      const stock = await tx.generatedPin.findFirst({
        where: { tenantId: tenant.id, studentId: null, soldAt: null, isUsed: false, onlineSaleReference: null, batch: { status: 'completed' } },
        include: { batch: { select: { pricePerPin: true } } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
      if (!stock) throw new Error('NO_PIN_STOCK');
      const amount = Number(stock.batch.pricePerPin);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('INVALID_STOCK_PRICE');
      const reserved = await tx.generatedPin.updateMany({
        where: { id: stock.id, tenantId: tenant.id, soldAt: null, studentId: null, isUsed: false, onlineSaleReference: null },
        data: { studentId: student.id, termId: term.id, onlineSaleReference: paymentReference, reservedUntil: new Date(Date.now() + 30 * 60 * 1000) },
      });
      if (reserved.count !== 1) throw new Error('STOCK_RACE');
      return tx.paymentIntent.create({
        data: { tenantId: tenant.id, reference: paymentReference, purpose: 'result_pin', studentId: student.id, termId: term.id, amount, payerEmail: customerEmail, status: 'initializing' },
      });
    });

    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: customerEmail,
        amount: Math.round(Number(intent.amount) * 100),
        reference: paymentReference,
        callback_url: `${req.nextUrl.origin}/api/platform/paystack/callback`,
        metadata: { type: 'result_pin', tenantId: tenant.id, slug: tenant.slug, studentId: student.id, termId: term.id },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.status || payload.data?.reference !== paymentReference || !payload.data?.authorization_url) {
      throw new Error('PAYSTACK_INITIALIZATION_FAILED');
    }
    await prisma.paymentIntent.update({ where: { reference: paymentReference }, data: { status: 'initialized' } });
    return NextResponse.json({ success: true, authorizationUrl: payload.data.authorization_url, paymentRef: paymentReference, pricePaid: Number(intent.amount) });
  } catch (error) {
    if (tenantId && reference) {
      const safeTenantId = tenantId;
      const safeRef = reference;
      await prisma.$transaction(async (tx) => {
        await tx.paymentIntent.updateMany({ where: { reference: safeRef, tenantId: safeTenantId, status: 'initializing' }, data: { status: 'failed' } });
        await tx.generatedPin.updateMany({ where: { tenantId: safeTenantId, onlineSaleReference: safeRef, soldAt: null }, data: { studentId: null, termId: null, onlineSaleReference: null, reservedUntil: null } });
      }).catch(() => undefined);
    }
    if (error instanceof Error && error.message === 'NO_PIN_STOCK') {
      return NextResponse.json({ error: 'This school has no purchased Result PINs available. Please contact the school.' }, { status: 409 });
    }
    if (error instanceof Error && error.message === 'STOCK_RACE') {
      return NextResponse.json({ error: 'That PIN was just reserved by another buyer. Please try again.' }, { status: 409 });
    }
    if (error instanceof Error && error.message === 'PAYSTACK_INITIALIZATION_FAILED') {
      return NextResponse.json({ error: 'The school Paystack account could not start this payment. Please try again.' }, { status: 502 });
    }
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'A Result PIN purchase for this student and term is already pending.' }, { status: 409 });
    }
    console.error('[PIN stock purchase] Could not start payment.');
    return NextResponse.json({ error: 'Could not initialize this Result PIN purchase.' }, { status: 500 });
  }
}
