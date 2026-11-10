import { NextResponse } from 'next/server';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { tenantHasFeature } from '@/lib/features';
import { recordOfflinePayment } from '@/lib/fees';
import { recordAuditLog } from '@/lib/audit';
import { getClientIp } from '@/lib/rate-limiter';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const auth = await getTenantUserFromCookies();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const hasFeature = await tenantHasFeature(auth.tenant.id, 'school_fees');
    if (!hasFeature) {
      return NextResponse.json({ error: 'School fee tracking is not enabled on your plan tier' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');
    const termId = searchParams.get('termId');

    if (!studentId || !termId) {
      return NextResponse.json(
        { error: 'studentId and termId query parameters are required' },
        { status: 400 }
      );
    }

    if (auth.user.role === 'student') {
      if (auth.user.studentId !== studentId) {
        return NextResponse.json({ error: 'Forbidden: You can only view your own payment history' }, { status: 403 });
      }
    } else if (auth.user.role === 'parent') {
      const { getParentWardsForUser } = await import('@/lib/guardian');
      const parentData = await getParentWardsForUser(auth.tenant.id, auth.user);
      if (!parentData.studentIds.includes(studentId)) {
        return NextResponse.json({ error: 'Forbidden: You can only view payment history for your linked wards' }, { status: 403 });
      }
    }

    const payments = await prisma.feePayment.findMany({
      where: {
        studentId,
        termId,
        student: { tenantId: auth.tenant.id },
      },
      include: {
        recordedStaff: {
          select: { id: true, name: true },
        },
      },
      orderBy: { paidAt: 'desc' },
    });

    return NextResponse.json({ payments });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getTenantUserFromCookies();
    if (!auth || (auth.user.role !== 'school_admin' && auth.user.role !== 'teacher')) {
      return NextResponse.json(
        { error: 'Unauthorized — Only staff/admin can record offline payments' },
        { status: 403 }
      );
    }

    const hasFeature = await tenantHasFeature(auth.tenant.id, 'school_fees');
    if (!hasFeature) {
      return NextResponse.json({ error: 'School fee tracking is not enabled on your plan tier' }, { status: 403 });
    }

    const staffId = auth.user.staffId;
    if (!staffId) {
      return NextResponse.json(
        { error: 'User account is not linked to a staff record' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { studentId, termId, amount, method, paymentRef } = body;

    if (!studentId || !termId || !amount || !method) {
      return NextResponse.json(
        { error: 'studentId, termId, amount, and method are required' },
        { status: 400 }
      );
    }

    if (method !== 'cash' && method !== 'bank_transfer') {
      return NextResponse.json(
        { error: 'Offline payment method must be cash or bank_transfer' },
        { status: 400 }
      );
    }

    const payment = await recordOfflinePayment(
      auth.tenant.id,
      staffId,
      studentId,
      termId,
      Number(amount),
      method,
      paymentRef
    );

    const clientIp = getClientIp(request);
    await recordAuditLog({
      tenantId: auth.tenant.id,
      actorId: auth.user.id,
      actorName: auth.user.staffProfile?.name || auth.user.username,
      actorRole: auth.user.role,
      action: 'FEE_PAYMENT_RECORDED',
      entityType: 'FeePayment',
      entityId: payment.id,
      details: {
        studentId,
        termId,
        amount: Number(amount),
        method,
        paymentRef: paymentRef || null,
      },
      ipAddress: clientIp,
    });

    return NextResponse.json({ payment }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
