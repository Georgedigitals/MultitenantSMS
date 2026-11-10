import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { calculateStudentFeeBalance } from '@/lib/fees';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = req.headers.get('x-tenant-slug') || searchParams.get('slug') || undefined;
    const tenant = await getTenantContext({ slug });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const auth = await getTenantUserFromCookies(tenant.id);
    const userRole = (auth as any)?.user?.role || (auth as any)?.role;
    if (!auth || (userRole !== 'school_admin' && userRole !== 'teacher')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const statusFilter = searchParams.get('status');
    const whereClause: any = { tenantId: tenant.id };
    if (statusFilter && ['pending', 'approved', 'rejected'].includes(statusFilter)) {
      whereClause.status = statusFilter;
    }

    const verifications = await prisma.feePaymentVerification.findMany({
      where: whereClause,
      include: {
        student: {
          select: {
            id: true,
            name: true,
            enrollments: {
              include: {
                classLevel: { select: { id: true, name: true } },
              },
              take: 1,
              orderBy: { session: { startDate: 'desc' } },
            },
          },
        },
        term: {
          select: { id: true, name: true },
        },
        reviewer: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const formatted = verifications.map((v) => ({
      id: v.id,
      studentId: v.studentId,
      studentName: v.student.name,
      className: v.student.enrollments[0]?.classLevel?.name || 'Class Unassigned',
      termId: v.termId,
      termName: v.term.name,
      amount: Number(v.amount),
      senderName: v.senderName,
      bankName: v.bankName,
      transactionRef: v.transactionRef,
      proofUrl: v.proofUrl,
      status: v.status,
      rejectionReason: v.rejectionReason,
      reviewerName: v.reviewer?.name || null,
      reviewedAt: v.reviewedAt ? v.reviewedAt.toISOString() : null,
      createdAt: v.createdAt.toISOString(),
    }));

    const pendingCount = await prisma.feePaymentVerification.count({
      where: { tenantId: tenant.id, status: 'pending' },
    });

    return NextResponse.json({
      success: true,
      verifications: formatted,
      pendingCount,
    });
  } catch (err: any) {
    console.error('[Get Verifications Error]', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = req.headers.get('x-tenant-slug') || searchParams.get('slug') || undefined;
    const tenant = await getTenantContext({ slug });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const body = await req.json();
    const { studentId, termId, amount, senderName, bankName, transactionRef, proofUrl } = body;

    if (typeof studentId !== 'string' || !studentId || typeof termId !== 'string' || !termId || amount === undefined || amount === null || typeof senderName !== 'string' || !senderName.trim() || typeof bankName !== 'string' || !bankName.trim() || typeof transactionRef !== 'string' || !transactionRef.trim()) {
      return NextResponse.json(
        { error: 'Student ID, Term, Amount, Sender Name, and Bank Name are required' },
        { status: 400 }
      );
    }

    const [student, term] = await Promise.all([
      prisma.student.findFirst({
        where: { id: studentId, tenantId: tenant.id },
      }),
      prisma.term.findFirst({
        where: { id: termId, session: { tenantId: tenant.id } },
        select: { id: true },
      }),
    ]);

    if (!student || !term) {
      return NextResponse.json({ error: 'Student or term not found in this school' }, { status: 404 });
    }

    const numericAmount = typeof amount === 'number' ? amount : Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > 50_000_000) {
      return NextResponse.json({ error: 'Enter a valid payment amount.' }, { status: 400 });
    }

    const auth = await getTenantUserFromCookies(tenant.id);
    if (auth) {
      let authorized = auth.user.role === 'student' && auth.user.studentId === studentId;
      if (auth.user.role === 'parent') {
        const parent = await prisma.tenantUser.findFirst({ where: { id: auth.user.id, tenantId: tenant.id }, select: { guardianId: true } });
        authorized = Boolean(parent?.guardianId && await prisma.studentGuardian.findFirst({
          where: { guardianId: parent.guardianId, studentId, student: { tenantId: tenant.id } }, select: { id: true },
        }));
      }
      if (!authorized) return NextResponse.json({ error: 'Your account is not linked to this student.' }, { status: 403 });
    }

    const feeBalance = await calculateStudentFeeBalance(tenant.id, studentId, termId);
    if (feeBalance.totalAssigned <= 0 || feeBalance.balanceRemaining <= 0) {
      return NextResponse.json({ error: 'There is no outstanding fee balance for this student and term.' }, { status: 400 });
    }
    if (numericAmount > feeBalance.balanceRemaining) {
      return NextResponse.json({ error: 'Reported transfer cannot exceed the outstanding balance.' }, { status: 400 });
    }
    const cleanRef = transactionRef.trim().slice(0, 100);
    const duplicate = await prisma.feePaymentVerification.findFirst({
      where: { tenantId: tenant.id, transactionRef: cleanRef }, select: { id: true },
    });
    if (duplicate) return NextResponse.json({ error: 'This bank transaction reference has already been submitted.' }, { status: 409 });
    const cleanProofUrl = typeof proofUrl === 'string' ? proofUrl.trim() : '';
    if (cleanProofUrl && (cleanProofUrl.length > 500 || !(cleanProofUrl.startsWith('/uploads/') || /^https:\/\//i.test(cleanProofUrl)))) {
      return NextResponse.json({ error: 'Receipt must be an uploaded HTTPS image or document link.' }, { status: 400 });
    }

    // Create verification request
    const verification = await prisma.feePaymentVerification.create({
      data: {
        tenantId: tenant.id,
        studentId,
        termId,
        amount: numericAmount,
        senderName: senderName.trim().slice(0, 120),
        bankName: bankName.trim().slice(0, 100),
        transactionRef: cleanRef,
        proofUrl: cleanProofUrl || null,
        status: 'pending',
      },
    });

    // Notify School Bursar / Admins
    await prisma.notification.create({
      data: {
        tenantId: tenant.id,
        recipientId: 'school_admin_role',
        recipientType: 'school_admin',
        type: 'fee_transfer_verification',
        message: `Offline fee transfer proof submitted for ${student.name} (₦${numericAmount.toLocaleString()}). Awaiting approval.`,
        link: '/dashboard/fees/verifications',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Payment proof submitted successfully. Once verified by the bursar, your clearance will be granted.',
      verificationId: verification.id,
    });
  } catch (err: any) {
    console.error('[Submit Verification Error]', err);
    return NextResponse.json({ error: err.message || 'Failed to submit payment proof' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = req.headers.get('x-tenant-slug') || searchParams.get('slug') || undefined;
    const tenant = await getTenantContext({ slug });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const auth = await getTenantUserFromCookies(tenant.id);
    const userRole = (auth as any)?.user?.role || (auth as any)?.role;
    if (!auth || (userRole !== 'school_admin' && userRole !== 'teacher')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    const staffId = (auth as any)?.user?.staffId || (auth as any)?.staffId || null;

    const body = await req.json();
    const { verificationId, action, rejectionReason } = body;

    if (!verificationId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Valid verificationId and action (approve/reject) required' }, { status: 400 });
    }

    const verification = await prisma.feePaymentVerification.findUnique({
      where: { id: verificationId },
      include: { student: true, term: true },
    });

    if (!verification || verification.tenantId !== tenant.id) {
      return NextResponse.json({ error: 'Verification record not found' }, { status: 404 });
    }

    if (verification.status !== 'pending') {
      return NextResponse.json({ error: `Verification is already ${verification.status}` }, { status: 400 });
    }

    if (action === 'approve') {
      // Execute atomically in Prisma transaction
      const result = await prisma.$transaction(async (tx) => {
        const claimed = await tx.feePaymentVerification.updateMany({
          where: { id: verificationId, tenantId: tenant.id, status: 'pending' },
          data: { status: 'approved', reviewedById: staffId, reviewedAt: new Date() },
        });
        if (!claimed.count) throw new Error('VERIFICATION_ALREADY_REVIEWED');

        // 2. Insert FeePayment record into student's fee ledger
        const feePayment = await tx.feePayment.create({
          data: {
            studentId: verification.studentId,
            termId: verification.termId,
            amount: verification.amount,
            method: 'bank_transfer',
            paymentRef: verification.transactionRef || `TRF-VERIF-${verification.id.slice(-6)}`,
            recordedBy: staffId,
            paidAt: new Date(),
          },
        });

        // 3. Dispatch confirmation notification to student/parent
        await tx.notification.create({
          data: {
            tenantId: tenant.id,
            recipientId: verification.studentId,
            recipientType: 'student',
            type: 'fee_payment_verified',
            message: `Bank transfer payment of ₦${Number(verification.amount).toLocaleString()} has been approved. Result clearance granted!`,
            link: '/results/check',
          },
        });

        return { feePayment };
      });

      const { dispatchAutoFeeAlert } = await import('@/lib/sms-service');
      void dispatchAutoFeeAlert({
        tenantId: tenant.id,
        studentId: verification.studentId,
        termId: verification.termId,
        amountPaid: Number(verification.amount),
        paymentRef: result.feePayment.paymentRef,
      });

      return NextResponse.json({
        success: true,
        message: 'Payment verified and credited to fee ledger. Student fee clearance granted.',
        paymentId: result.feePayment.id,
      });
    } else {
      // Reject verification
      const updated = await prisma.feePaymentVerification.update({
        where: { id: verificationId },
        data: {
          status: 'rejected',
          rejectionReason: rejectionReason || 'Payment details could not be reconciled with bank statement.',
          reviewedById: staffId,
          reviewedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Payment verification marked as rejected.',
        verification: updated,
      });
    }
  } catch (err: any) {
    if (err?.message === 'VERIFICATION_ALREADY_REVIEWED') return NextResponse.json({ error: 'This transfer was already reviewed by another bursar.' }, { status: 409 });
    console.error('[Review Verification Error]', err);
    return NextResponse.json({ error: err.message || 'Failed to update verification' }, { status: 500 });
  }
}
