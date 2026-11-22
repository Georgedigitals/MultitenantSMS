import prisma from './prisma';
import { findStudentByIdOrAdmissionNo } from './student-resolver';
import crypto from 'crypto';
import { verifyWebhookSignature } from './webhook-idempotency';
import { getTenantGatewayConfig } from './tenant-payments';
import { getPlatformLocalization } from './platform-settings';
import {
  fromMinorUnit,
  isCurrencySupportedByGateway,
  toMinorUnit,
  verifyStripeWebhookSignature,
} from './payments/gateway';

export interface FeeBalanceResult {
  studentId: string;
  termId: string;
  classLevelId: string | null;
  feeItems: Array<{
    id: string;
    name: string;
    amount: number;
    classLevelId: string | null;
  }>;
  adjustments: Array<{
    id: string;
    feeItemId: string;
    adjustmentType: string;
    amountOrPercent: number;
  }>;
  payments: Array<{
    id: string;
    amount: number;
    method: string;
    paymentRef: string | null;
    recordedBy: string | null;
    paidAt: Date;
  }>;
  totalAssigned: number;
  totalAdjustments: number;
  totalPaid: number;
  balanceRemaining: number;
  isFullyPaid: boolean;
  isPartiallyPaid: boolean;
}

export interface TermFeeOverviewResult {
  termId: string;
  totalStudents: number;
  totalExpected: number;
  totalAdjustments: number;
  totalCollected: number;
  totalOutstanding: number;
  fullyPaidCount: number;
  partiallyPaidCount: number;
  unpaidCount: number;
  noFeesCount: number;
  students: Array<{
    studentId: string;
    studentName: string;
    classLevelId: string | null;
    classLevelName: string | null;
    totalAssigned: number;
    totalAdjustments: number;
    totalPaid: number;
    balanceRemaining: number;
    status: 'paid' | 'partial' | 'unpaid' | 'no_fees';
  }>;
}

/**
 * Calculates the exact fee ledger balance for a student and term (§6A.2).
 * Balance is NEVER stored as a mutable total; it is computed strictly on-the-fly:
 * balance = sum(applicable FeeItems) - sum(StudentFeeAdjustments) - sum(FeePayments)
 */
export async function calculateStudentFeeBalance(
  tenantId: string,
  studentId: string,
  termId: string
): Promise<FeeBalanceResult> {
  const cleanStudentIdentifier = studentId.trim();

  // 1. Fetch term and session details
  const term = await prisma.term.findUnique({
    where: { id: termId },
  });
  if (!term) throw new Error('Term not found or tenant mismatch');

  const session = await prisma.academicSession.findUnique({
    where: { id: term.sessionId },
  });
  if (!session || session.tenantId !== tenantId) {
    throw new Error('Term not found or tenant mismatch');
  }

  // 2. Resolve canonical student ID (supports primary key ID or official admissionNumber)
  const student = await findStudentByIdOrAdmissionNo(tenantId, cleanStudentIdentifier);
  const canonicalStudentId = student ? student.id : cleanStudentIdentifier;

  // 3. Fetch student enrollment for this session
  const enrollment = await prisma.enrollment.findUnique({
    where: {
      studentId_sessionId: {
        studentId: canonicalStudentId,
        sessionId: term.sessionId,
      },
    },
  });

  const classLevelId = enrollment?.classLevelId || null;

  // 4. Fetch applicable FeeItems (all class levels OR student's class level)
  const applicableFeeItems = await prisma.feeItem.findMany({
    where: {
      tenantId,
      termId,
      OR: [
        { classLevelId: null },
        ...(classLevelId ? [{ classLevelId }] : []),
      ],
    },
  });

  const feeItemIds = applicableFeeItems.map((fi: any) => fi.id);

  // 5. Fetch StudentFeeAdjustments for applicable fee items
  const adjustments = feeItemIds.length > 0
    ? await prisma.studentFeeAdjustment.findMany({
        where: {
          studentId: canonicalStudentId,
          feeItemId: { in: feeItemIds },
        },
      })
    : [];

  // 6. Fetch all FeePayments for student and term
  const payments = await prisma.feePayment.findMany({
    where: {
      studentId: canonicalStudentId,
      termId,
    },
    orderBy: { paidAt: 'desc' },
  });

  // 6. Calculate Totals
  const totalAssigned = applicableFeeItems.reduce(
    (sum: number, item: any) => sum + Number(item.amount),
    0
  );

  const totalAdjustments = adjustments.reduce(
    (sum: number, adj: any) => sum + Number(adj.amountOrPercent),
    0
  );

  const totalPaid = payments.reduce(
    (sum: number, pay: any) => sum + Number(pay.amount),
    0
  );

  const rawBalance = totalAssigned - totalAdjustments - totalPaid;
  const balanceRemaining = Math.max(0, rawBalance);

  const isFullyPaid = balanceRemaining === 0 && (totalAssigned > 0 || totalPaid > 0);
  const isPartiallyPaid = totalPaid > 0 && balanceRemaining > 0;

  return {
    studentId,
    termId,
    classLevelId,
    feeItems: applicableFeeItems.map((fi: any) => ({
      id: fi.id,
      name: fi.name,
      amount: Number(fi.amount),
      classLevelId: fi.classLevelId,
    })),
    adjustments: adjustments.map((adj: any) => ({
      id: adj.id,
      feeItemId: adj.feeItemId,
      adjustmentType: adj.adjustmentType,
      amountOrPercent: Number(adj.amountOrPercent),
    })),
    payments: payments.map((pay: any) => ({
      id: pay.id,
      amount: Number(pay.amount),
      method: pay.method,
      paymentRef: pay.paymentRef,
      recordedBy: pay.recordedBy,
      paidAt: pay.paidAt,
    })),
    totalAssigned,
    totalAdjustments,
    totalPaid,
    balanceRemaining,
    isFullyPaid,
    isPartiallyPaid,
  };
}

/**
 * Gets an aggregated school-wide fee overview for a term (§6A.3).
 */
export async function getTermFeeOverview(
  tenantId: string,
  termId: string,
  filterClassLevelId?: string
): Promise<TermFeeOverviewResult> {
  const term = await prisma.term.findUnique({
    where: { id: termId },
  });
  if (!term) throw new Error('Term not found or tenant mismatch');

  const session = await prisma.academicSession.findUnique({
    where: { id: term.sessionId },
  });
  if (!session || session.tenantId !== tenantId) {
    throw new Error('Term not found or tenant mismatch');
  }

  // Fetch all enrollments for session
  const rawEnrollments = await prisma.enrollment.findMany({
    where: {
      sessionId: term.sessionId,
      ...(filterClassLevelId ? { classLevelId: filterClassLevelId } : {}),
    },
  });

  const studentIds = rawEnrollments.map((e: any) => e.studentId);
  const classIds = Array.from(new Set(rawEnrollments.map((e: any) => e.classLevelId))).filter(Boolean);

  const [studentsList, classList] = await Promise.all([
    studentIds.length > 0 ? prisma.student.findMany({ where: { id: { in: studentIds }, tenantId } }) : [],
    classIds.length > 0 ? prisma.classLevel.findMany({ where: { id: { in: classIds } } }) : [],
  ]);

  const studentMap = new Map(studentsList.map((s: any) => [s.id, s]));
  const classMap = new Map(classList.map((c: any) => [c.id, c]));

  const enrollments = rawEnrollments
    .filter((e: any) => studentMap.has(e.studentId))
    .map((e: any) => ({
      ...e,
      student: studentMap.get(e.studentId)!,
      classLevel: classMap.get(e.classLevelId) || { name: 'Unknown' },
    }));

  let totalExpected = 0;
  let totalAdjustments = 0;
  let totalCollected = 0;
  let totalOutstanding = 0;
  let fullyPaidCount = 0;
  let partiallyPaidCount = 0;
  let unpaidCount = 0;
  let noFeesCount = 0;

  const studentSummaries = [];

  for (const enr of enrollments) {
    const feeBal = await calculateStudentFeeBalance(tenantId, enr.studentId, termId);
    totalExpected += feeBal.totalAssigned;
    totalAdjustments += feeBal.totalAdjustments;
    totalCollected += feeBal.totalPaid;
    totalOutstanding += feeBal.balanceRemaining;

    let status: 'paid' | 'partial' | 'unpaid' | 'no_fees' = 'no_fees';
    if (feeBal.totalAssigned === 0 && feeBal.totalPaid === 0) {
      status = 'no_fees';
      noFeesCount++;
    } else if (feeBal.isFullyPaid) {
      status = 'paid';
      fullyPaidCount++;
    } else if (feeBal.isPartiallyPaid) {
      status = 'partial';
      partiallyPaidCount++;
    } else {
      status = 'unpaid';
      unpaidCount++;
    }

    studentSummaries.push({
      studentId: enr.student.id,
      studentName: enr.student.name,
      classLevelId: enr.classLevelId,
      classLevelName: enr.classLevel.name,
      totalAssigned: feeBal.totalAssigned,
      totalAdjustments: feeBal.totalAdjustments,
      totalPaid: feeBal.totalPaid,
      balanceRemaining: feeBal.balanceRemaining,
      status,
    });
  }

  return {
    termId,
    totalStudents: enrollments.length,
    totalExpected,
    totalAdjustments,
    totalCollected,
    totalOutstanding,
    fullyPaidCount,
    partiallyPaidCount,
    unpaidCount,
    noFeesCount,
    students: studentSummaries,
  };
}

/**
 * Manually records an offline payment (cash / bank transfer) attributed to staff (§6A.3).
 */
export async function recordOfflinePayment(
  tenantId: string,
  staffId: string,
  studentId: string,
  termId: string,
  amount: number,
  method: 'cash' | 'bank_transfer',
  paymentRef?: string
) {
  if (!Number.isFinite(amount) || amount <= 0 || amount > 50_000_000) {
    throw new Error('Payment amount must be greater than zero');
  }

  // Verify staff belongs to tenant
  const staff = await prisma.staff.findFirst({
    where: { id: staffId, tenantId },
  });
  if (!staff) {
    throw new Error('Invalid recording staff member for tenant');
  }

  // Verify student belongs to tenant (supports primary key ID or official admissionNumber)
  const cleanStudentIdentifier = studentId.trim();
  const student = await findStudentByIdOrAdmissionNo(tenantId, cleanStudentIdentifier);
  if (!student) {
    throw new Error('Invalid student for tenant');
  }

  const payment = await prisma.feePayment.create({
    data: {
      studentId: student.id,
      termId,
      amount,
      method: method as any,
      paymentRef: paymentRef || null,
      recordedBy: staffId,
    },
  });

  // Trigger automated SMS payment receipt if enabled
  const { dispatchAutoFeeAlert } = await import('./sms-service');
  void dispatchAutoFeeAlert({
    tenantId,
    studentId: student.id,
    termId,
    amountPaid: amount,
    paymentRef: payment.paymentRef,
  });

  return payment;
}

/**
 * Initializes an online fee payment checkout (§6A.4).
 * Supports partial payments up to the balance remaining.
 */
export async function initializeFeePayment(
  tenantId: string,
  studentId: string,
  termId: string,
  amount: number,
  customerEmail: string,
  callbackUrl: string
) {
  if (amount <= 0) {
    throw new Error('Payment amount must be greater than zero');
  }

  const feeBal = await calculateStudentFeeBalance(tenantId, studentId, termId);
  if (feeBal.totalAssigned <= 0 || feeBal.balanceRemaining <= 0) {
    throw new Error('There is no outstanding school-fee balance for this student and term');
  }
  const localization = await getPlatformLocalization();
  const { currencyCode, currencySymbol } = localization;

  if (amount > feeBal.balanceRemaining) {
    throw new Error(
      `Payment amount (${currencySymbol}${amount}) exceeds remaining fee balance (${currencySymbol}${feeBal.balanceRemaining})`
    );
  }

  if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    throw new Error('A valid payer email is required');
  }
  const [gatewayCfg, tenant, student] = await Promise.all([
    getTenantGatewayConfig(tenantId),
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true, name: true, hasOnlinePayment: true } }),
    findStudentByIdOrAdmissionNo(tenantId, studentId),
  ]);
  if (!tenant) throw new Error('School not found');
  if (!tenant.hasOnlinePayment) throw new Error('This school has disabled online fee payments');
  if (!gatewayCfg) throw new Error('This school has not configured its own payment gateway for fee payments');
  if (!student) throw new Error('Student not found for this school');

  if (!isCurrencySupportedByGateway(gatewayCfg.provider, currencyCode)) {
    throw new Error(
      `This school's payment gateway (${gatewayCfg.provider}) does not support ${currencyCode}. Ask the school admin to switch to Stripe or Flutterwave in School Settings → Payments.`
    );
  }

  const paymentRef = `FEE_${crypto.randomUUID().replace(/-/g, '')}`;
  await prisma.paymentIntent.create({
    data: { tenantId, reference: paymentRef, purpose: 'fee_payment', studentId: student.id, termId, amount, payerEmail: customerEmail, status: 'initializing' },
  });
  try {
    let authorizationUrl = '';

    if (gatewayCfg.provider === 'stripe') {
      const params = new URLSearchParams();
      params.set('mode', 'payment');
      params.set('client_reference_id', paymentRef);
      params.set('customer_email', customerEmail);
      params.set('success_url', `${callbackUrl}?provider=stripe&reference=${encodeURIComponent(paymentRef)}`);
      params.set('cancel_url', callbackUrl);
      params.set('line_items[0][quantity]', '1');
      params.set('line_items[0][price_data][currency]', currencyCode.toLowerCase());
      params.set('line_items[0][price_data][unit_amount]', String(toMinorUnit(amount, currencyCode)));
      params.set('line_items[0][price_data][product_data][name]', `${tenant.name} — School Fees (${student.name})`);
      params.set('metadata[type]', 'fee_payment');
      params.set('metadata[reference]', paymentRef);
      params.set('metadata[tenantId]', tenantId);
      params.set('metadata[slug]', tenant.slug);
      params.set('metadata[studentId]', student.id);
      params.set('metadata[termId]', termId);
      params.set('metadata[amount]', String(amount));

      const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${gatewayCfg.secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Idempotency-Key': paymentRef,
        },
        body: params.toString(),
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.url) {
        throw new Error('The school Stripe account could not start this payment. Please check with the school bursar.');
      }
      authorizationUrl = result.url;
    } else if (gatewayCfg.provider === 'flutterwave') {
      const response = await fetch('https://api.flutterwave.com/v3/payments', {
        method: 'POST',
        headers: { Authorization: `Bearer ${gatewayCfg.secretKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tx_ref: paymentRef,
          amount,
          currency: currencyCode,
          redirect_url: `${callbackUrl}?provider=flutterwave&reference=${encodeURIComponent(paymentRef)}`,
          customer: { email: customerEmail, name: student.name },
          customizations: { title: `${tenant.name} — School Fees` },
          meta: { type: 'fee_payment', tenantId, slug: tenant.slug, studentId: student.id, termId, amount },
        }),
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.status !== 'success' || !result?.data?.link) {
        throw new Error('The school Flutterwave account could not start this payment. Please check with the school bursar.');
      }
      authorizationUrl = result.data.link;
    } else {
      const response = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: { Authorization: `Bearer ${gatewayCfg.secretKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: customerEmail,
          amount: toMinorUnit(amount, currencyCode),
          currency: currencyCode,
          reference: paymentRef,
          callback_url: callbackUrl,
          metadata: { type: 'fee_payment', tenantId, slug: tenant.slug, studentId: student.id, termId, amount },
        }),
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.status || result.data?.reference !== paymentRef || !result.data?.authorization_url) {
        throw new Error('The school Paystack account could not start this payment. Please check with the school bursar.');
      }
      authorizationUrl = result.data.authorization_url;
    }

    await prisma.paymentIntent.update({ where: { reference: paymentRef }, data: { status: 'initialized' } });
    return {
      paymentRef,
      amount,
      currency: currencyCode,
      provider: gatewayCfg.provider,
      studentId: student.id,
      termId,
      tenantId,
      customerEmail,
      authorizationUrl,
    };
  } catch (error) {
    await prisma.paymentIntent.updateMany({ where: { reference: paymentRef, status: 'initializing' }, data: { status: 'failed' } });
    throw error;
  }
}

/**
 * Processes a verified webhook notification for fee payments (§6A.4, §11.4).
 */
export async function processFeePaymentWebhook(
  provider: 'paystack' | 'flutterwave' | 'stripe',
  rawPayload: any,
  signature: string,
  tenantSecret?: string
) {
  let paymentRef: string;
  let amount: number;
  let studentId: string;
  let termId: string;
  let tenantId: string | undefined;

  const rawString = typeof rawPayload === 'string' ? rawPayload : JSON.stringify(rawPayload);

  const signatureValid =
    provider === 'stripe'
      ? verifyStripeWebhookSignature(rawString, signature, tenantSecret)
      : verifyWebhookSignature(provider, rawString, signature, tenantSecret);

  if (!signatureValid) {
    throw new Error(`Invalid ${provider} webhook signature`);
  }

  let payload: any;
  if (typeof rawPayload === 'object' && rawPayload !== null) {
    payload = rawPayload;
  } else {
    try {
      payload = JSON.parse(rawString);
    } catch {
      throw new Error('Invalid webhook JSON payload');
    }
  }

  if (provider === 'stripe') {
    const session = payload.data?.object || {};
    const currency = String(session.currency || 'USD').toUpperCase();
    paymentRef = session.client_reference_id || session.metadata?.reference || '';
    amount = fromMinorUnit(Number(session.amount_total || 0), currency);
    studentId = session.metadata?.studentId;
    termId = session.metadata?.termId;
    tenantId = session.metadata?.tenantId;
  } else if (provider === 'paystack') {
    const data = payload.data;
    const currency = String(data.currency || 'NGN').toUpperCase();
    paymentRef = data.reference;
    amount = fromMinorUnit(Number(data.amount || 0), currency);
    studentId = data.metadata?.studentId;
    termId = data.metadata?.termId;
    tenantId = data.metadata?.tenantId;

    if (!tenantId && termId) {
      const termRec = await prisma.term.findUnique({
        where: { id: termId },
        include: { session: true },
      });
      if (termRec?.session?.tenantId) {
        tenantId = termRec.session.tenantId;
      }
    }
    if (!tenantId && studentId) {
      const studentRec = await prisma.student.findUnique({
        where: { id: studentId },
      });
      if (studentRec?.tenantId) {
        tenantId = studentRec.tenantId;
      }
    }
  } else {
    const data = payload.data;
    paymentRef = data.tx_ref;
    amount = Number(data.amount);
    studentId = data.meta?.studentId;
    termId = data.meta?.termId;
  }

  if (!paymentRef || !studentId || !termId || (provider === 'paystack' && !tenantId) || !Number.isFinite(amount) || amount <= 0) {
    throw new Error('Missing required fee metadata in webhook payload');
  }

  // Idempotency check (§11.4)
  const existingPayment = await prisma.feePayment.findFirst({ where: { paymentRef } });
  if (existingPayment) return existingPayment;

  const cleanStudentIdentifier = studentId.trim();
  const student = await findStudentByIdOrAdmissionNo(tenantId || null, cleanStudentIdentifier);
  if (!student) throw new Error('Fee payment student does not belong to the stated school');
  const canonicalStudentId = student ? student.id : cleanStudentIdentifier;
  const term = await prisma.term.findFirst({
    where: tenantId
      ? { id: termId, session: { tenantId } }
      : { id: termId },
    select: { id: true },
  });
  if (!term) throw new Error('Fee payment term does not belong to the stated school');

  const payment = await prisma.feePayment.create({
    data: {
      studentId: canonicalStudentId,
      termId,
      amount,
      method: 'gateway' as any,
      paymentRef,
      recordedBy: null, // Online gateway payment
    },
  });

  if (student?.tenantId) {
    const { dispatchAutoFeeAlert } = await import('./sms-service');
    void dispatchAutoFeeAlert({
      tenantId: student.tenantId,
      studentId: canonicalStudentId,
      termId,
      amountPaid: amount,
      paymentRef,
    });

    // In-app notification for school admin / bursar
    const { currencySymbol } = await getPlatformLocalization();
    prisma.notification.create({
      data: {
        tenantId: student.tenantId,
        recipientId: 'school_admin_role',
        recipientType: 'school_admin',
        type: 'fee_payment_online',
        message: `Online fee payment of ${currencySymbol}${amount.toLocaleString()} received for ${student.name}${paymentRef ? ` (Ref: ${paymentRef})` : ''}.`,
        link: '/dashboard/fees',
      },
    }).catch(() => {});
  }

  return payment;
}

/**
 * Checks if a student has an outstanding fee balance that blocks promotion (§6A.5).
 */
export async function checkStudentFeeClearance(
  tenantId: string,
  studentId: string,
  termId: string
) {
  const feeBal = await calculateStudentFeeBalance(tenantId, studentId, termId);
  return {
    hasOutstandingBalance: feeBal.balanceRemaining > 0,
    balanceRemaining: feeBal.balanceRemaining,
    isFullyPaid: feeBal.isFullyPaid,
  };
}

/**
 * Records or updates a student fee adjustment (discount or waiver) (§6A.2).
 */
export async function recordFeeAdjustment(
  tenantId: string,
  studentId: string,
  feeItemId: string,
  adjustmentType: 'discount' | 'waiver',
  amountOrPercent: number
) {
  if (!Number.isFinite(amountOrPercent) || amountOrPercent <= 0) {
    throw new Error('Adjustment amount must be greater than zero');
  }

  const feeItem = await prisma.feeItem.findFirst({
    where: { id: feeItemId, tenantId },
  });
  if (!feeItem) {
    throw new Error('Invalid fee item for this school');
  }

  const student = await findStudentByIdOrAdmissionNo(tenantId, studentId.trim());
  if (!student) {
    throw new Error('Invalid student for this school');
  }

  return prisma.studentFeeAdjustment.upsert({
    where: {
      studentId_feeItemId: {
        studentId: student.id,
        feeItemId,
      },
    },
    update: {
      adjustmentType: adjustmentType as any,
      amountOrPercent,
    },
    create: {
      studentId: student.id,
      feeItemId,
      adjustmentType: adjustmentType as any,
      amountOrPercent,
    },
  });
}

/**
 * Removes a student fee adjustment (revoking a discount or waiver).
 */
export async function removeFeeAdjustment(
  tenantId: string,
  studentId: string,
  feeItemId: string
) {
  const student = await findStudentByIdOrAdmissionNo(tenantId, studentId.trim());
  if (!student) {
    throw new Error('Invalid student for this school');
  }

  const existing = await prisma.studentFeeAdjustment.findUnique({
    where: {
      studentId_feeItemId: {
        studentId: student.id,
        feeItemId,
      },
    },
    include: { student: true },
  });

  if (!existing || existing.student.tenantId !== tenantId) {
    throw new Error('Fee adjustment not found for this student');
  }

  return prisma.studentFeeAdjustment.delete({
    where: {
      studentId_feeItemId: {
        studentId: student.id,
        feeItemId,
      },
    },
  });
}

/**
 * Clones fee items from a source term to a target term, with an optional percentage adjustment.
 */
export async function copyFeeItemsBetweenTerms(
  tenantId: string,
  sourceTermId: string,
  targetTermId: string,
  percentageAdjustment = 0
) {
  if (sourceTermId === targetTermId) {
    throw new Error('Source and target terms cannot be the same');
  }

  const [sourceTerm, targetTerm] = await Promise.all([
    prisma.term.findUnique({ where: { id: sourceTermId }, include: { session: true } }),
    prisma.term.findUnique({ where: { id: targetTermId }, include: { session: true } }),
  ]);

  if (!sourceTerm || sourceTerm.session.tenantId !== tenantId) {
    throw new Error('Source term not found or tenant mismatch');
  }
  if (!targetTerm || targetTerm.session.tenantId !== tenantId) {
    throw new Error('Target term not found or tenant mismatch');
  }

  const sourceItems = await prisma.feeItem.findMany({
    where: { tenantId, termId: sourceTermId },
  });

  if (sourceItems.length === 0) {
    throw new Error('Source term has no fee items to copy');
  }

  const multiplier = 1 + (Number(percentageAdjustment) || 0) / 100;

  return prisma.$transaction(async (tx) => {
    const created = [];
    for (const item of sourceItems) {
      const rawAmount = Number(item.amount) * multiplier;
      const adjustedAmount = Math.max(1, Math.round(rawAmount));
      const newItem = await tx.feeItem.create({
        data: {
          tenantId,
          termId: targetTermId,
          classLevelId: item.classLevelId,
          name: item.name,
          amount: adjustedAmount,
        },
        include: {
          classLevel: true,
        },
      });
      created.push(newItem);
    }
    return created;
  });
}
