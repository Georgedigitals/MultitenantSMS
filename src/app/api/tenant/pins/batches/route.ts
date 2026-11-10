import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';

export async function GET(req: NextRequest) {
  try {
    const slug = req.headers.get('x-tenant-slug') || req.nextUrl.searchParams.get('slug') || undefined;
    const tenant = await getTenantContext({ slug });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    if (!tenant.hasFeature('result_pins')) return NextResponse.json({ error: 'Result PINs are not enabled for this school.' }, { status: 403 });
    const auth = await getTenantUserFromCookies(tenant.id);
    if (!auth || auth.user.role !== 'school_admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const [batches, legacyOnlinePins, stockOnlineSales, bankTransferPins, freshTenant, availablePinsCount] = await Promise.all([
      prisma.pinBatch.findMany({
        where: { tenantId: tenant.id },
        include: { _count: { select: { pins: true } }, pins: { select: { isUsed: true, usesCount: true, studentId: true, soldAt: true, onlineSaleReference: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.resultPIN.findMany({
        where: { student: { tenantId: tenant.id }, paymentRef: { startsWith: 'PIN_' } },
        include: { student: { select: { id: true, name: true } }, term: { select: { name: true, session: { select: { label: true } } } } },
        orderBy: { createdAt: 'desc' }, take: 200,
      }),
      prisma.generatedPin.findMany({
        where: { tenantId: tenant.id, onlineSaleReference: { not: null }, soldAt: { not: null } },
        include: { student: { select: { id: true, name: true } }, term: { select: { name: true, session: { select: { label: true } } } }, batch: { select: { pricePerPin: true } } },
        orderBy: { soldAt: 'desc' }, take: 200,
      }),
      prisma.pinTransferVerification.findMany({
        where: { tenantId: tenant.id },
        include: { student: { select: { name: true } }, term: { select: { name: true, session: { select: { label: true } } } }, reviewer: { select: { name: true } } },
        orderBy: { createdAt: 'desc' }, take: 200,
      }),
      prisma.tenant.findUnique({ where: { id: tenant.id }, select: { pinPrice: true, plan: { select: { platformFeePercent: true } } } }),
      prisma.generatedPin.count({ where: { tenantId: tenant.id, studentId: null, soldAt: null, isUsed: false, onlineSaleReference: null, batch: { status: 'completed' } } }),
    ]);

    const formatted = batches.map((batch) => {
      const totalGenerated = batch._count.pins;
      const usedPinsCount = batch.pins.filter((pin) => pin.isUsed || pin.usesCount > 0).length;
      const unusedPinsCount = batch.pins.filter((pin) => !pin.soldAt && !pin.studentId && !pin.isUsed && pin.usesCount === 0).length;
      return {
        id: batch.id, batchNumber: batch.batchNumber, quantity: batch.quantity || totalGenerated,
        maxUsesPerPin: batch.maxUsesPerPin, pricePerPin: Number(batch.pricePerPin),
        platformFeeTotal: Number(batch.platformFeeTotal), platformFeePercent: Number(batch.platformFeePercent),
        paymentRef: batch.paymentRef, status: batch.status, createdAt: batch.createdAt.toISOString(),
        totalGenerated, usedPinsCount, unusedPinsCount,
        onlineSoldCount: batch.pins.filter((pin) => Boolean(pin.soldAt && pin.onlineSaleReference)).length,
        totalSessionsUsed: batch.pins.reduce((sum, pin) => sum + pin.usesCount, 0),
      };
    });
    const totalPinsGenerated = formatted.reduce((sum, batch) => sum + batch.totalGenerated, 0);
    const totalPinsUsed = formatted.reduce((sum, batch) => sum + batch.usedPinsCount, 0);
    const onlinePinTotals = legacyOnlinePins.reduce((totals, pin) => ({
      gross: totals.gross + Number(pin.pricePaid), platformFee: totals.platformFee + Number(pin.platformFee),
      schoolNet: totals.schoolNet + Number(pin.schoolNet),
      pendingSchoolPayout: totals.pendingSchoolPayout + (pin.settlementId ? 0 : Number(pin.schoolNet)),
      settledSchoolPayout: totals.settledSchoolPayout + (pin.settlementId ? Number(pin.schoolNet) : 0),
    }), { gross: 0, platformFee: 0, schoolNet: 0, pendingSchoolPayout: 0, settledSchoolPayout: 0 });
    const schoolDirectSales = stockOnlineSales.reduce((sum, pin) => sum + Number(pin.batch.pricePerPin), 0);

    const historicalSales = legacyOnlinePins.map((pin) => ({
      id: pin.id, studentName: pin.student.name, termName: `${pin.term.session.label} · ${pin.term.name}`,
      paymentRef: pin.paymentRef, amount: Number(pin.pricePaid), platformFee: Number(pin.platformFee),
      schoolNet: Number(pin.schoolNet), payoutStatus: pin.settlementId ? 'paid' : 'awaiting platform payout',
      status: pin.status, paidAt: pin.createdAt.toISOString(), source: 'Legacy direct PIN purchase',
    }));
    const stockSales = stockOnlineSales.map((pin) => {
      const amount = Number(pin.batch.pricePerPin);
      return {
        id: pin.id, studentName: pin.student?.name || 'Student',
        termName: pin.term ? `${pin.term.session.label} · ${pin.term.name}` : 'Term not recorded',
        paymentRef: pin.onlineSaleReference, amount, platformFee: 0, schoolNet: amount,
        payoutStatus: 'paid directly to school', status: pin.isUsed ? 'active' : 'unused',
        paidAt: (pin.soldAt || pin.createdAt).toISOString(), source: 'Prepaid school stock',
      };
    });

    return NextResponse.json({
      success: true,
      batches: formatted,
      onlinePurchases: [...stockSales, ...historicalSales].sort((a, b) => b.paidAt.localeCompare(a.paidAt)).slice(0, 200),
      bankTransferPurchases: bankTransferPins.map((transfer) => ({
        id: transfer.id, studentName: transfer.student.name,
        termName: `${transfer.term.session.label} · ${transfer.term.name}`,
        paymentRef: transfer.transactionRef, amount: Number(transfer.amount), status: transfer.status,
        rejectionReason: transfer.rejectionReason, senderName: transfer.senderName,
        bankName: transfer.bankName, proofUrl: transfer.proofUrl,
        reviewerName: transfer.reviewer?.name || null, paidAt: transfer.createdAt.toISOString(),
      })),
      stats: {
        totalPinsGenerated, totalPinsUsed, totalPinsRemaining: availablePinsCount,
        currentSellingPrice: Number(freshTenant?.pinPrice ?? tenant.pinPrice ?? 1000),
        platformFeePercent: Number(freshTenant?.plan.platformFeePercent ?? 10),
        onlinePinTotals: {
          ...onlinePinTotals,
          gross: onlinePinTotals.gross + schoolDirectSales,
          schoolNet: onlinePinTotals.schoolNet + schoolDirectSales,
          schoolDirectSales,
        }, tenantBranding: tenant.branding, schoolName: tenant.name,
      },
    });
  } catch (error) {
    console.error('[Get PIN Batches Error]');
    return NextResponse.json({ error: 'Could not load Result PIN batches.' }, { status: 500 });
  }
}
