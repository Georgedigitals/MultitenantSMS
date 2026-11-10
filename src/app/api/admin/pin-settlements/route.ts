import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSuperAdminFromCookies } from '@/lib/auth/super-admin-auth';

export async function GET(req: NextRequest) {
  const auth = await getSuperAdminFromCookies();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true, slug: true }, orderBy: { name: 'asc' } });
  const selectedTenantId = req.nextUrl.searchParams.get('tenantId');
  const outstanding = await Promise.all(tenants.map(async (tenant) => {
    const aggregate = await prisma.resultPIN.aggregate({
      where: { student: { tenantId: tenant.id }, paymentRef: { startsWith: 'PIN_' }, settlementId: null },
      _count: { id: true },
      _sum: { pricePaid: true, platformFee: true, schoolNet: true },
    });
    return {
      ...tenant,
      pinCount: aggregate._count.id,
      gross: Number(aggregate._sum.pricePaid || 0),
      platformFee: Number(aggregate._sum.platformFee || 0),
      schoolNetDue: Number(aggregate._sum.schoolNet || 0),
    };
  }));
  const settlements = await prisma.pinSettlement.findMany({
    include: { tenant: { select: { name: true, slug: true } }, _count: { select: { pins: true } } },
    orderBy: { settledAt: 'desc' },
    take: 200,
  });
  const selectedTenant = selectedTenantId ? await prisma.tenant.findUnique({ where: { id: selectedTenantId }, select: { id: true } }) : null;
  const pendingPins = selectedTenant ? await prisma.resultPIN.findMany({
    where: { student: { tenantId: selectedTenant.id }, paymentRef: { startsWith: 'PIN_' }, settlementId: null },
    select: {
      id: true, pricePaid: true, platformFee: true, schoolNet: true, paymentRef: true, createdAt: true,
      student: { select: { name: true } }, term: { select: { name: true, session: { select: { label: true } } } },
    },
    orderBy: { createdAt: 'asc' },
    take: 500,
  }) : [];
  return NextResponse.json({ outstanding: outstanding.filter((item) => item.pinCount > 0), pendingPins: pendingPins.map((pin) => ({
    id: pin.id, studentName: pin.student.name, termName: `${pin.term.session.label} · ${pin.term.name}`,
    amount: Number(pin.pricePaid), platformFee: Number(pin.platformFee), schoolNet: Number(pin.schoolNet),
    paymentRef: pin.paymentRef, purchasedAt: pin.createdAt.toISOString(),
  })), settlements: settlements.map((item) => ({
    id: item.id, tenantName: item.tenant.name, tenantSlug: item.tenant.slug, pinCount: item._count.pins,
    gross: Number(item.grossAmount), platformFee: Number(item.platformFeeAmount), schoolNet: Number(item.schoolNetAmount),
    payoutReference: item.payoutReference, settledAt: item.settledAt.toISOString(),
  })) });
}

export async function POST(req: NextRequest) {
  const auth = await getSuperAdminFromCookies();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const tenantId = typeof body.tenantId === 'string' ? body.tenantId : '';
    const rawIds: unknown[] = Array.isArray(body.pinIds) ? body.pinIds : [];
    const pinIds: string[] = Array.from(new Set<string>(rawIds.filter((id): id is string => typeof id === 'string'))).slice(0, 500);
    const payoutReference = typeof body.payoutReference === 'string' ? body.payoutReference.trim().slice(0, 120) : '';
    if (!tenantId || !pinIds.length || !payoutReference || payoutReference.length < 4) {
      return NextResponse.json({ error: 'Select at least one PIN and enter the completed bank payout reference.' }, { status: 400 });
    }
    const pins = await prisma.resultPIN.findMany({
      where: { id: { in: pinIds }, student: { tenantId }, paymentRef: { startsWith: 'PIN_' }, settlementId: null },
      select: { id: true, pricePaid: true, platformFee: true, schoolNet: true },
    });
    if (pins.length !== pinIds.length) return NextResponse.json({ error: 'One or more selected PIN sales are already settled or do not belong to this school.' }, { status: 409 });
    const gross = pins.reduce((sum, pin) => sum + Number(pin.pricePaid), 0);
    const platformFee = pins.reduce((sum, pin) => sum + Number(pin.platformFee), 0);
    const schoolNet = pins.reduce((sum, pin) => sum + Number(pin.schoolNet), 0);
    const settlement = await prisma.$transaction(async (tx) => {
      const record = await tx.pinSettlement.create({
        data: { tenantId, grossAmount: gross, platformFeeAmount: platformFee, schoolNetAmount: schoolNet, payoutReference, settledBy: auth.superAdmin.id },
      });
      const updated = await tx.resultPIN.updateMany({
        where: { id: { in: pinIds }, student: { tenantId }, paymentRef: { startsWith: 'PIN_' }, settlementId: null },
        data: { settlementId: record.id },
      });
      if (updated.count !== pinIds.length) throw new Error('PINS_SETTLED_CONCURRENTLY');
      return record;
    });
    return NextResponse.json({ success: true, settlementId: settlement.id, pinCount: pins.length, gross, platformFee, schoolNet });
  } catch (error) {
    if (error instanceof Error && (error.message === 'PINS_SETTLED_CONCURRENTLY' || (error as any).code === 'P2002')) {
      return NextResponse.json({ error: 'The selected PIN payout was already recorded or another payout used this reference.' }, { status: 409 });
    }
    console.error('[PIN settlement] Could not record payout');
    return NextResponse.json({ error: 'Could not record this PIN payout.' }, { status: 500 });
  }
}
