import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant';
import prisma from '@/lib/prisma';
import { calculateStudentFeeBalance, initializeFeePayment } from '@/lib/fees';

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = req.headers.get('x-tenant-slug') || searchParams.get('slug') || undefined;
    const tenant = await getTenantContext({ slug });

    if (!tenant) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }
    if (!tenant.hasOnlinePayment) {
      return NextResponse.json({ error: 'Online school-fee payments are disabled by this school. Please use the displayed bank-transfer details or contact the bursar.' }, { status: 403 });
    }

    const body = await req.json();
    const { studentId, termId, amount, customerEmail } = body;

    if (typeof studentId !== 'string' || !studentId.trim() || typeof termId !== 'string' || !termId || amount === undefined || amount === null) {
      return NextResponse.json(
        { error: 'Student ID, Term, and Amount are required' },
        { status: 400 }
      );
    }

    const numericAmount = typeof amount === 'number' ? amount : Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount < 1 || numericAmount > 50_000_000) {
      return NextResponse.json({ error: 'Enter a valid payment amount between ₦1 and ₦50,000,000.' }, { status: 400 });
    }

    // Verify student belongs to this tenant (supports id or admission number)
    const cleanStudentIdentifier = studentId.trim();
    const student = await prisma.student.findFirst({
      where: {
        tenantId: tenant.id,
        OR: [{ id: cleanStudentIdentifier }, { admissionNumber: cleanStudentIdentifier }],
      },
      include: { tenant: true },
    });

    if (!student) {
      return NextResponse.json(
        { error: 'Student not found in this institution' },
        { status: 404 }
      );
    }

    const term = await prisma.term.findFirst({
      where: { id: termId, session: { tenantId: tenant.id } },
      select: { id: true },
    });
    if (!term) {
      return NextResponse.json({ error: 'Academic term not found for this school.' }, { status: 404 });
    }

    // Verify fee balance
    const feeBal = await calculateStudentFeeBalance(tenant.id, student.id, termId);
    if (feeBal.totalAssigned <= 0 || feeBal.balanceRemaining <= 0) {
      return NextResponse.json({ error: 'There is no outstanding school-fee balance for this student and term.' }, { status: 400 });
    }
    if (numericAmount > feeBal.balanceRemaining) {
      return NextResponse.json(
        { error: `Payment amount (₦${numericAmount.toLocaleString()}) exceeds outstanding balance (₦${feeBal.balanceRemaining.toLocaleString()})` },
        { status: 400 }
      );
    }

    const payerEmail = typeof customerEmail === 'string' ? customerEmail.trim() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payerEmail)) {
      return NextResponse.json({ error: 'Enter a valid payer email address.' }, { status: 400 });
    }
    const result = await initializeFeePayment(
      tenant.id,
      student.id,
      term.id,
      numericAmount,
      payerEmail,
      `${req.nextUrl.origin}/api/platform/paystack/callback`,
    );
    return NextResponse.json({ success: true, authorizationUrl: result.authorizationUrl, paymentRef: result.paymentRef, amount: result.amount });
  } catch (error: any) {
    console.error('[Public Fee Payment Initialization Error]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to initialize online fee payment' },
      { status: 500 }
    );
  }
}
