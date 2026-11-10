import { NextRequest, NextResponse } from 'next/server';
import { PaymentVerificationStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireTenantAccess } from '@/lib/auth/tenant-access';

function tenantSlug(req: NextRequest) {
  return req.headers.get('x-tenant-slug') || req.nextUrl.searchParams.get('slug') || '';
}

async function canAccessStudent(tenantId: string, user: NonNullable<Awaited<ReturnType<typeof requireTenantAccess>>['user']>, studentId: string) {
  if (user.role === 'student') return user.studentId === studentId;
  if (user.role !== 'parent') return false;
  const account = await prisma.tenantUser.findFirst({
    where: { id: user.id, tenantId, role: 'parent', guardianId: { not: null } },
    select: { guardianId: true },
  });
  if (!account?.guardianId) return false;
  return Boolean(await prisma.studentGuardian.findFirst({
    where: { guardianId: account.guardianId, studentId, student: { tenantId } },
    select: { id: true },
  }));
}

export async function GET(req: NextRequest) {
  const access = await requireTenantAccess(tenantSlug(req), ['school_admin', 'parent', 'student']);
  if (!access.authorized || !access.tenant || !access.user) {
    return NextResponse.json({ error: access.error || 'Unauthorized' }, { status: access.statusCode || 401 });
  }
  if (!access.tenant.hasFeature('result_pins')) return NextResponse.json({ error: 'Result PINs are not enabled for this school.' }, { status: 403 });

  if (access.user.role === 'school_admin') {
    const records = await prisma.pinTransferVerification.findMany({
      where: { tenantId: access.tenant.id },
      include: {
        student: { select: { id: true, name: true, admissionNumber: true } },
        term: { select: { name: true, session: { select: { label: true } } } },
        reviewer: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return NextResponse.json({
      verifications: records.map((r) => ({ ...r, amount: Number(r.amount), resultPinId: r.resultPinId, reviewerName: r.reviewer?.name || null })),
    });
  }

  let studentIds: string[] = [];
  if (access.user.role === 'student' && access.user.studentId) studentIds = [access.user.studentId];
  if (access.user.role === 'parent') {
    const parent = await prisma.tenantUser.findFirst({
      where: { id: access.user.id, tenantId: access.tenant.id },
      select: { guardianId: true },
    });
    if (parent?.guardianId) {
      const links = await prisma.studentGuardian.findMany({
        where: { guardianId: parent.guardianId, student: { tenantId: access.tenant.id } },
        select: { studentId: true },
      });
      studentIds = links.map((link) => link.studentId);
    }
  }
  const records = await prisma.pinTransferVerification.findMany({
    where: { tenantId: access.tenant.id, studentId: { in: studentIds } },
    include: {
      student: { select: { id: true, name: true } },
      term: { select: { name: true, session: { select: { label: true } } } },
      resultPin: { select: { code: true, expiresAt: true } },
      generatedPin: { select: { pinCode: true, serialNumber: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return NextResponse.json({
    verifications: records.map((r) => ({ ...r, generatedPin: r.status === 'approved' ? r.generatedPin : null, amount: Number(r.amount) })),
  });
}

export async function POST(req: NextRequest) {
  const access = await requireTenantAccess(tenantSlug(req), ['parent', 'student']);
  if (!access.authorized || !access.tenant || !access.user) {
    return NextResponse.json({ error: access.error || 'Unauthorized' }, { status: access.statusCode || 401 });
  }
  if (!access.tenant.hasFeature('result_pins')) return NextResponse.json({ error: 'Result PINs are not enabled for this school.' }, { status: 403 });
  try {
    const body = await req.json();
    const studentId = typeof body.studentId === 'string' ? body.studentId : '';
    const termId = typeof body.termId === 'string' ? body.termId : '';
    const senderName = typeof body.senderName === 'string' ? body.senderName.trim().slice(0, 120) : '';
    const bankName = typeof body.bankName === 'string' ? body.bankName.trim().slice(0, 100) : '';
    const transactionRef = typeof body.transactionRef === 'string' ? body.transactionRef.trim().slice(0, 100) : '';
    const proofUrl = typeof body.proofUrl === 'string' ? body.proofUrl.trim() : '';
    if (!studentId || !termId || !senderName || !bankName || !transactionRef) {
      return NextResponse.json({ error: 'Student, term, sender name, transfer bank and transaction reference are required.' }, { status: 400 });
    }
    if (proofUrl && (proofUrl.length > 500 || !(proofUrl.startsWith('/uploads/') || /^https:\/\//i.test(proofUrl)))) {
      return NextResponse.json({ error: 'Receipt must be an uploaded HTTPS image or document link.' }, { status: 400 });
    }
    if (!(await canAccessStudent(access.tenant.id, access.user, studentId))) {
      return NextResponse.json({ error: 'You do not have access to this student.' }, { status: 403 });
    }
    const [student, term, stock] = await Promise.all([
      prisma.student.findFirst({ where: { id: studentId, tenantId: access.tenant.id }, select: { id: true, name: true } }),
      prisma.term.findFirst({ where: { id: termId, session: { tenantId: access.tenant.id } }, select: { id: true, name: true } }),
      prisma.generatedPin.findFirst({
        where: { tenantId: access.tenant.id, studentId: null, soldAt: null, isUsed: false, onlineSaleReference: null, batch: { status: 'completed' } },
        include: { batch: { select: { pricePerPin: true } } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
    ]);
    const tenant = await prisma.tenant.findUnique({ where: { id: access.tenant.id }, select: { bankAccountNumber: true } });
    if (!student || !term || !tenant) return NextResponse.json({ error: 'Student or term was not found for this school.' }, { status: 404 });
    if (!stock) return NextResponse.json({ error: 'This school has no purchased Result PINs available.' }, { status: 409 });
    if (!tenant.bankAccountNumber) return NextResponse.json({ error: 'The school has not configured bank-transfer details.' }, { status: 409 });
    const amount = Number(stock.batch.pricePerPin);
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Result PIN price is not configured.' }, { status: 409 });
    const pending = await prisma.pinTransferVerification.findFirst({
      where: { tenantId: access.tenant.id, studentId, termId, status: 'pending' },
      select: { id: true },
    });
    if (pending) return NextResponse.json({ error: 'There is already a pending PIN transfer request for this student and term.' }, { status: 409 });

    const created = await prisma.$transaction(async (tx) => {
      const record = await tx.pinTransferVerification.create({
        data: { tenantId: access.tenant!.id, studentId, termId, amount, senderName, bankName, transactionRef, proofUrl: proofUrl || null },
        select: { id: true, amount: true, status: true, createdAt: true },
      });
      const currentStock = await tx.generatedPin.findFirst({
        where: { tenantId: access.tenant!.id, studentId: null, soldAt: null, isUsed: false, onlineSaleReference: null, batch: { status: 'completed', pricePerPin: amount } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
      if (!currentStock) throw new Error('PIN_STOCK_RACE');
      const reserved = await tx.generatedPin.updateMany({
        where: { id: currentStock.id, tenantId: access.tenant!.id, studentId: null, soldAt: null, isUsed: false, onlineSaleReference: null },
        data: { studentId, termId },
      });
      if (reserved.count !== 1) throw new Error('PIN_STOCK_RACE');
      await tx.pinTransferVerification.update({ where: { id: record.id }, data: { generatedPinId: currentStock.id } });
      await tx.notification.create({
        data: {
          tenantId: access.tenant!.id,
          recipientId: 'school_admin_role',
          recipientType: 'school_admin',
          type: 'pin_transfer_verification',
          message: `A bank transfer for a Result PIN for ${student.name} is awaiting bursar review.`,
          link: '/dashboard/results/pins',
        },
      });
      return record;
    });
    return NextResponse.json({ verification: { ...created, amount: Number(created.amount) } }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'PIN_STOCK_RACE') return NextResponse.json({ error: 'That Result PIN stock was just reserved. Please submit the transfer again to get the current amount.' }, { status: 409 });
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'A pending transfer or an existing transfer reference is already recorded.' }, { status: 409 });
    }
    console.error('[PIN transfer submit] Request could not be saved');
    return NextResponse.json({ error: 'Could not submit the transfer for review.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const access = await requireTenantAccess(tenantSlug(req), ['school_admin']);
  if (!access.authorized || !access.tenant || !access.user) {
    return NextResponse.json({ error: access.error || 'Unauthorized' }, { status: access.statusCode || 401 });
  }
  if (!access.tenant.hasFeature('result_pins')) return NextResponse.json({ error: 'Result PINs are not enabled for this school.' }, { status: 403 });
  try {
    const body = await req.json();
    const id = typeof body.id === 'string' ? body.id : '';
    const action = body.action;
    const reason = typeof body.rejectionReason === 'string' ? body.rejectionReason.trim().slice(0, 500) : '';
    if (!id || !['approve', 'reject'].includes(action)) return NextResponse.json({ error: 'A verification ID and approve/reject action are required.' }, { status: 400 });
    const verification = await prisma.pinTransferVerification.findFirst({
      where: { id, tenantId: access.tenant.id },
      include: { term: { select: { endDate: true } }, student: { select: { id: true, name: true } } },
    });
    if (!verification) return NextResponse.json({ error: 'Transfer request not found.' }, { status: 404 });
    if (verification.status !== PaymentVerificationStatus.pending) return NextResponse.json({ error: 'This transfer has already been reviewed.' }, { status: 409 });
    if (action === 'reject') {
      const changed = await prisma.$transaction(async (tx) => {
        const updated = await tx.pinTransferVerification.updateMany({
          where: { id, tenantId: access.tenant!.id, status: 'pending' },
          data: { status: 'rejected', rejectionReason: reason || 'Transfer could not be confirmed in the school account.', reviewedById: access.user!.staffId, reviewedAt: new Date() },
        });
        if (updated.count && verification.generatedPinId) {
          await tx.generatedPin.updateMany({
            where: { id: verification.generatedPinId, tenantId: access.tenant!.id, studentId: verification.studentId, termId: verification.termId, soldAt: null, onlineSaleReference: null },
            data: { studentId: null, termId: null },
          });
        }
        return updated;
      });
      if (!changed.count) return NextResponse.json({ error: 'This transfer was reviewed by another bursar.' }, { status: 409 });
      return NextResponse.json({ success: true, status: 'rejected' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const changed = await tx.pinTransferVerification.updateMany({
        where: { id, tenantId: access.tenant!.id, status: 'pending' },
        data: { status: 'approved', reviewedById: access.user!.staffId, reviewedAt: new Date() },
      });
      if (!changed.count) throw new Error('REVIEWED_CONCURRENTLY');
      const stockPin = await tx.generatedPin.findFirst({
        where: {
          id: verification.generatedPinId || undefined,
          tenantId: access.tenant!.id,
          studentId: verification.generatedPinId ? verification.studentId : null,
          termId: verification.generatedPinId ? verification.termId : undefined,
          soldAt: null, isUsed: false, onlineSaleReference: null,
          batch: { status: 'completed', pricePerPin: verification.amount },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
      if (!stockPin) throw new Error('PIN_STOCK_UNAVAILABLE');
      const assigned = await tx.generatedPin.updateMany({
        where: {
          id: stockPin.id, tenantId: access.tenant!.id,
          studentId: verification.generatedPinId ? verification.studentId : null,
          termId: verification.generatedPinId ? verification.termId : undefined,
          soldAt: null, isUsed: false, onlineSaleReference: null,
        },
        data: { studentId: verification.studentId, termId: verification.termId, soldAt: new Date() },
      });
      if (assigned.count !== 1) throw new Error('PIN_STOCK_RACE');
      await tx.pinTransferVerification.update({ where: { id }, data: { generatedPinId: stockPin.id } });
      await tx.notification.create({
        data: {
          tenantId: access.tenant!.id,
          recipientId: verification.studentId,
          recipientType: 'student',
          type: 'pin_transfer_approved',
          message: `Your bank transfer for the Result PIN for ${verification.student.name} was approved. Sign in to view your PIN.`,
          link: '/portal/results',
        },
      });
      return stockPin;
    });
    return NextResponse.json({ success: true, status: 'approved', pinId: result.id });
  } catch (error) {
    if (error instanceof Error && error.message === 'REVIEWED_CONCURRENTLY') return NextResponse.json({ error: 'This transfer was reviewed by another bursar.' }, { status: 409 });
    if (error instanceof Error && ['PIN_STOCK_UNAVAILABLE', 'PIN_STOCK_RACE'].includes(error.message)) return NextResponse.json({ error: 'No unassigned PIN remains at the verified transfer amount. The request is still pending.' }, { status: 409 });
    console.error('[PIN transfer review] Request could not be completed');
    return NextResponse.json({ error: 'Could not review this transfer.' }, { status: 500 });
  }
}
