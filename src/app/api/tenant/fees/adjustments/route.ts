import { NextResponse } from 'next/server';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { tenantHasFeature } from '@/lib/features';
import prisma from '@/lib/prisma';
import { recordFeeAdjustment, removeFeeAdjustment } from '@/lib/fees';

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

    if (!studentId) {
      return NextResponse.json({ error: 'studentId is required' }, { status: 400 });
    }

    const adjustments = await prisma.studentFeeAdjustment.findMany({
      where: {
        studentId,
        student: { tenantId: auth.tenant.id },
      },
      include: {
        feeItem: true,
      },
    });

    return NextResponse.json({ adjustments });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getTenantUserFromCookies();
    if (!auth || (auth.user.role !== 'school_admin' && auth.user.role !== 'teacher')) {
      return NextResponse.json({ error: 'Unauthorized — Admin or Teacher role required' }, { status: 403 });
    }

    const hasFeature = await tenantHasFeature(auth.tenant.id, 'school_fees');
    if (!hasFeature) {
      return NextResponse.json({ error: 'School fee tracking is not enabled on your plan tier' }, { status: 403 });
    }

    const body = await request.json();
    const { studentId, feeItemId, adjustmentType, amountOrPercent } = body;

    if (!studentId || !feeItemId || !adjustmentType || amountOrPercent === undefined) {
      return NextResponse.json(
        { error: 'studentId, feeItemId, adjustmentType, and amountOrPercent are required' },
        { status: 400 }
      );
    }

    const numValue = Number(amountOrPercent);
    if (isNaN(numValue) || numValue <= 0) {
      return NextResponse.json({ error: 'Adjustment value must be greater than zero' }, { status: 400 });
    }

    if (adjustmentType !== 'discount' && adjustmentType !== 'waiver') {
      return NextResponse.json({ error: 'adjustmentType must be "discount" or "waiver"' }, { status: 400 });
    }

    const adjustment = await recordFeeAdjustment(
      auth.tenant.id,
      studentId,
      feeItemId,
      adjustmentType,
      numValue
    );

    return NextResponse.json({ success: true, adjustment });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await getTenantUserFromCookies();
    if (!auth || (auth.user.role !== 'school_admin' && auth.user.role !== 'teacher')) {
      return NextResponse.json({ error: 'Unauthorized — Admin or Teacher role required' }, { status: 403 });
    }

    const hasFeature = await tenantHasFeature(auth.tenant.id, 'school_fees');
    if (!hasFeature) {
      return NextResponse.json({ error: 'School fee tracking is not enabled on your plan tier' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const studentId = searchParams.get('studentId');
    const feeItemId = searchParams.get('feeItemId');

    if (id) {
      const existing = await prisma.studentFeeAdjustment.findUnique({
        where: { id },
        include: { student: true },
      });
      if (!existing || existing.student.tenantId !== auth.tenant.id) {
        return NextResponse.json({ error: 'Adjustment not found or access denied' }, { status: 404 });
      }
      await prisma.studentFeeAdjustment.delete({ where: { id } });
      return NextResponse.json({ success: true, message: 'Fee adjustment removed successfully' });
    }

    if (studentId && feeItemId) {
      await removeFeeAdjustment(auth.tenant.id, studentId, feeItemId);
      return NextResponse.json({ success: true, message: 'Fee adjustment removed successfully' });
    }

    return NextResponse.json({ error: 'id or (studentId and feeItemId) is required' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
