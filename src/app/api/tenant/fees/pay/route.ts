import { NextRequest, NextResponse } from 'next/server';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { tenantHasFeature } from '@/lib/features';
import { initializeFeePayment } from '@/lib/fees';
import prisma from '@/lib/prisma';
import { getPublicUrl } from '@/lib/public-url';

export async function POST(request: NextRequest) {
  try {
    const auth = await getTenantUserFromCookies();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const hasFeature = await tenantHasFeature(auth.tenant.id, 'school_fees');
    if (!hasFeature) {
      return NextResponse.json({ error: 'School fee tracking is not enabled on your plan tier' }, { status: 403 });
    }

    const body = await request.json();
    const { studentId, termId, amount, customerEmail } = body;

    if (!studentId || !termId || !amount) {
      return NextResponse.json(
        { error: 'studentId, termId, and amount are required' },
        { status: 400 }
      );
    }

    if (!['parent', 'student'].includes(auth.user.role)) {
      return NextResponse.json({ error: 'Only a student or linked parent can start a school-fee payment.' }, { status: 403 });
    }
    const student = await prisma.student.findFirst({
      where: { tenantId: auth.tenant.id, OR: [{ id: String(studentId) }, { admissionNumber: String(studentId) }] },
      select: { id: true },
    });
    if (!student) return NextResponse.json({ error: 'Student not found for this school.' }, { status: 404 });
    let allowed = auth.user.role === 'student' && auth.user.studentId === student.id;
    if (auth.user.role === 'parent') {
      const account = await prisma.tenantUser.findFirst({ where: { id: auth.user.id, tenantId: auth.tenant.id }, select: { guardianId: true } });
      allowed = Boolean(account?.guardianId && await prisma.studentGuardian.findFirst({
        where: { guardianId: account.guardianId, studentId: student.id, student: { tenantId: auth.tenant.id } }, select: { id: true },
      }));
    }
    if (!allowed) return NextResponse.json({ error: 'Your account is not linked to this student.' }, { status: 403 });

    const result = await initializeFeePayment(
      auth.tenant.id,
      student.id,
      termId,
      Number(amount),
      customerEmail,
      getPublicUrl('/api/platform/paystack/callback', request).toString()
    );

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
