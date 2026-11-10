import { prisma } from '@/lib/prisma';
import { findStudentByIdOrAdmissionNo } from './student-resolver';
import crypto from 'crypto';
import { calculateStudentFeeBalance } from './fees';
import { sendResultPinPurchaseEmail } from './email-service';
import { verifyWebhookSignature } from './webhook-idempotency';

export interface PinFeeCalculation {
  pricePaid: number;
  platformFee: number;
  schoolNet: number;
  platformFeePercent: number;
}

export interface BatchFeeCalculation {
  quantity: number;
  pricePerPin: number;
  platformFeePercent: number;
  platformFeePerPin: number;
  totalPlatformFee: number;
  projectedGrossRevenue: number;
  schoolNetRevenue: number;
}

export interface VerifyPinResult {
  isUnlocked: boolean;
  pin?: any;
  reason?: string;
  error?: string;
  pinType?: 'scratch_card' | 'digital_pin';
  usesRemaining?: number;
  balanceRemaining?: number;
  totalAssigned?: number;
  totalPaid?: number;
  feeBreakdown?: any[];
  bankDetails?: {
    bankName?: string | null;
    bankAccountNumber?: string | null;
    bankAccountName?: string | null;
  };
  hasOnlinePayment?: boolean;
  student?: {
    id: string;
    name: string;
    admissionNumber?: string | null;
  };
}

/**
 * Generates a cryptographically secure 12-digit PIN code formatted as XXXX-XXXX-XXXX
 */
export async function generatePinCode(): Promise<string> {
  let isUnique = false;
  let formattedCode = '';

  while (!isUnique) {
    const rawDigits = crypto.randomInt(100000000000, 999999999999).toString();
    formattedCode = `${rawDigits.slice(0, 4)}-${rawDigits.slice(4, 8)}-${rawDigits.slice(8, 12)}`;

    // Verify against both ResultPIN and GeneratedPin tables
    const [existingDigital, existingPhysical] = await Promise.all([
      prisma.resultPIN.findUnique({ where: { code: formattedCode } }),
      prisma.generatedPin.findUnique({ where: { pinCode: formattedCode } }),
    ]);

    if (!existingDigital && !existingPhysical) {
      isUnique = true;
    }
  }

  return formattedCode;
}

/**
 * Generates an authentic WAEC-style Serial Number (e.g. WRN193164310)
 */
export async function generateSerialNumber(prefix = 'WRN'): Promise<string> {
  let isUnique = false;
  let serial = '';

  while (!isUnique) {
    const suffix = crypto.randomInt(100000000, 999999999).toString();
    serial = `${prefix.toUpperCase()}${suffix}`;

    const existing = await prisma.generatedPin.findUnique({
      where: { serialNumber: serial },
    });

    if (!existing) {
      isUnique = true;
    }
  }

  return serial;
}

/**
 * Calculates PIN revenue split between school and platform based on tenant plan (§6).
 */
export async function calculatePinFees(tenantId: string): Promise<PinFeeCalculation> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { plan: true },
  });

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  const pricePaid = Number(tenant.pinPrice);
  const platformFeePercent = Number(tenant.plan.platformFeePercent);
  const platformFee = Math.round(pricePaid * (platformFeePercent / 100) * 100) / 100;
  const schoolNet = Math.round((pricePaid - platformFee) * 100) / 100;

  return {
    pricePaid,
    platformFee,
    schoolNet,
    platformFeePercent,
  };
}

/**
 * Calculates batch creation pricing and platform fee split for tenants ordering physical scratch cards
 */
export async function calculateBatchFees(
  tenantId: string,
  quantity: number,
  pricePerPin: number,
  feePercentOverride?: number,
): Promise<BatchFeeCalculation> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { plan: true },
  });

  if (!tenant) throw new Error('Tenant not found');

  const platformFeePercent = feePercentOverride ?? Number(tenant.plan.platformFeePercent || 10.0);
  if (!Number.isFinite(platformFeePercent) || platformFeePercent < 0 || platformFeePercent > 100) {
    throw new Error('PIN platform percentage must be between 0 and 100.');
  }
  const platformFeePerPin = Math.round(pricePerPin * (platformFeePercent / 100) * 100) / 100;
  const totalPlatformFee = Math.round(platformFeePerPin * quantity * 100) / 100;
  const projectedGrossRevenue = Math.round(pricePerPin * quantity * 100) / 100;
  const schoolNetRevenue = Math.round((projectedGrossRevenue - totalPlatformFee) * 100) / 100;

  return {
    quantity,
    pricePerPin,
    platformFeePercent,
    platformFeePerPin,
    totalPlatformFee,
    projectedGrossRevenue,
    schoolNetRevenue,
  };
}

/**
 * Generates an array of cryptographically unique PIN codes and serial numbers in bulk,
 * verifying uniqueness against the database in batched queries.
 */
export async function generateUniquePinBatchItems(
  quantity: number,
  prefix = 'WRN'
): Promise<Array<{ pinCode: string; serialNumber: string }>> {
  const cleanPrefix = (prefix || 'WRN').slice(0, 3).toUpperCase();
  const validItems: Array<{ pinCode: string; serialNumber: string }> = [];
  const generatedCodes = new Set<string>();
  const generatedSerials = new Set<string>();

  const CHUNK_SIZE = 500;
  while (validItems.length < quantity) {
    const needed = Math.min(quantity - validItems.length, CHUNK_SIZE);
    const candidateCodes: string[] = [];
    const candidateSerials: string[] = [];

    while (candidateCodes.length < needed) {
      const rawDigits = crypto.randomInt(100000000000, 999999999999).toString();
      const code = `${rawDigits.slice(0, 4)}-${rawDigits.slice(4, 8)}-${rawDigits.slice(8, 12)}`;
      if (!generatedCodes.has(code)) {
        generatedCodes.add(code);
        candidateCodes.push(code);
      }
    }

    while (candidateSerials.length < needed) {
      const suffix = crypto.randomInt(100000000, 999999999).toString();
      const serial = `${cleanPrefix}${suffix}`;
      if (!generatedSerials.has(serial)) {
        generatedSerials.add(serial);
        candidateSerials.push(serial);
      }
    }

    // Verify in database that candidates don't exist
    const [existingDigital, existingPhysical, existingSerials] = await Promise.all([
      prisma.resultPIN.findMany({
        where: { code: { in: candidateCodes } },
        select: { code: true },
      }),
      prisma.generatedPin.findMany({
        where: { pinCode: { in: candidateCodes } },
        select: { pinCode: true },
      }),
      prisma.generatedPin.findMany({
        where: { serialNumber: { in: candidateSerials } },
        select: { serialNumber: true },
      }),
    ]);

    const usedCodes = new Set([
      ...existingDigital.map((d) => d.code),
      ...existingPhysical.map((p) => p.pinCode),
    ]);
    const usedSerials = new Set(existingSerials.map((s) => s.serialNumber));

    for (let i = 0; i < needed; i++) {
      const code = candidateCodes[i];
      const serial = candidateSerials[i];
      if (!usedCodes.has(code) && !usedSerials.has(serial)) {
        validItems.push({ pinCode: code, serialNumber: serial });
      }
    }
  }

  return validItems;
}

/**
 * Creates a physical scratch card PIN batch and generates WAEC-style scratch cards.
 * Also alerts Super Admin about the platform fee revenue.
 */
export async function createPinBatch(options: {
  tenantId: string;
  quantity: number;
  pricePerPin: number;
  paymentRef?: string;
  maxUsesPerPin?: number;
  platformFeePercent?: number;
}) {
  const { tenantId, quantity, pricePerPin, paymentRef, maxUsesPerPin = 5, platformFeePercent } = options;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { plan: true },
  });

  if (!tenant) throw new Error('Tenant not found');

  const feeCalc = await calculateBatchFees(tenantId, quantity, pricePerPin, platformFeePercent);

  // Idempotency: if already processed for this paymentRef, return existing batch
  if (paymentRef) {
    const existingBatch = await prisma.pinBatch.findFirst({
      where: { tenantId, paymentRef },
    });
    if (existingBatch) {
      const pinCount = await prisma.generatedPin.count({
        where: { batchId: existingBatch.id },
      });
      return {
        batch: existingBatch,
        generatedCount: pinCount,
        feeCalc,
      };
    }
  }

  const batchNumber = `BATCH-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  const prefix = tenant.slug ? tenant.slug.slice(0, 3).toUpperCase() : 'WRN';

  // 1. Pre-generate unique PINs and Serial numbers OUTSIDE the transaction
  const pinItems = await generateUniquePinBatchItems(quantity, prefix);

  // 2. Execute DB writes atomically with extended transaction timeout
  return await prisma.$transaction(
    async (tx) => {
      // 1. Create PinBatch record
      const batch = await tx.pinBatch.create({
        data: {
          tenantId,
          batchNumber,
          quantity,
          pricePerPin: feeCalc.pricePerPin,
          platformFeeTotal: feeCalc.totalPlatformFee,
          platformFeePercent: feeCalc.platformFeePercent,
          maxUsesPerPin,
          paymentRef: paymentRef || `PSTK_BATCH_${Date.now()}`,
          status: 'completed',
          paidAt: new Date(),
        },
      });

      // 2. Prepare pins for bulk insertion
      const pinsData = pinItems.map((item) => ({
        batchId: batch.id,
        tenantId,
        serialNumber: item.serialNumber,
        pinCode: item.pinCode,
        pricePaid: feeCalc.pricePerPin,
      }));

      // 3. Bulk insert pins
      await tx.generatedPin.createMany({
        data: pinsData,
      });

      // 4. Dispatch Notification to Super Admin
      await tx.notification.create({
        data: {
          tenantId,
          recipientId: 'super_admin_global',
          recipientType: 'super_admin',
          type: 'pin_batch_purchased',
          message: `${tenant.name} generated ${quantity} Result Checker PINs. Platform revenue collected: ₦${feeCalc.totalPlatformFee.toLocaleString()}`,
          link: '/admin/pins',
        },
      });

      return {
        batch,
        generatedCount: pinsData.length,
        feeCalc,
      };
    },
    {
      maxWait: 10000,
      timeout: 30000,
    }
  );
}

/** Assigns one school-owned, previously paid-for PIN to an online buyer. */
export async function fulfillPinStockSale(options: {
  reference: string;
  tenantId: string;
  amountPaid: number;
  metadata?: Record<string, unknown>;
}) {
  const { reference, tenantId, amountPaid, metadata } = options;
  const intent = await prisma.paymentIntent.findUnique({ where: { reference } });
  if (!intent || intent.purpose !== 'result_pin' || intent.tenantId !== tenantId) {
    throw new Error('Result PIN order was not found for this school.');
  }
  if (!Number.isFinite(amountPaid) || Math.round(amountPaid * 100) !== Math.round(Number(intent.amount) * 100)) {
    throw new Error('Result PIN payment amount does not match the order.');
  }
  if (metadata && (metadata.tenantId !== tenantId || metadata.studentId !== intent.studentId || metadata.termId !== intent.termId)) {
    throw new Error('Result PIN payment details do not match the school order.');
  }
  if (!intent.studentId || !intent.termId) throw new Error('Result PIN order is missing its student or term.');

  const [student, term, reservedPin] = await Promise.all([
    prisma.student.findFirst({
      where: { id: intent.studentId, tenantId },
      include: { tenant: { select: { slug: true, name: true, branding: true } } },
    }),
    prisma.term.findFirst({ where: { id: intent.termId, session: { tenantId } }, include: { session: true } }),
    prisma.generatedPin.findFirst({ where: { onlineSaleReference: reference, tenantId }, include: { batch: true } }),
  ]);
  if (!student || !term || !reservedPin || Number(reservedPin.batch.pricePerPin) !== Number(intent.amount)) {
    throw new Error('The reserved Result PIN stock no longer matches this payment.');
  }

  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const currentIntent = await tx.paymentIntent.findUnique({ where: { reference } });
    if (currentIntent?.status === 'succeeded') {
      return { pin: reservedPin, newlyAssigned: false };
    }
    if (currentIntent?.status !== 'initialized') throw new Error('Result PIN order is not ready to be fulfilled.');

    const assigned = await tx.generatedPin.updateMany({
      where: { id: reservedPin.id, tenantId, onlineSaleReference: reference, soldAt: null, studentId: intent.studentId, termId: intent.termId },
      data: { studentId: intent.studentId, termId: intent.termId, soldAt: now, reservedUntil: null },
    });
    if (assigned.count !== 1) throw new Error('The reserved Result PIN has already been assigned.');

    const updatedIntent = await tx.paymentIntent.updateMany({
      where: { reference, tenantId, purpose: 'result_pin', status: 'initialized' },
      data: { status: 'succeeded' },
    });
    if (updatedIntent.count !== 1) throw new Error('Result PIN order was processed concurrently.');
    return { pin: reservedPin, newlyAssigned: true };
  });

  if (result.newlyAssigned) {
    const termName = `${term.session.label} ${term.name}`.trim();
    try {
      await sendResultPinPurchaseEmail({
        tenantId, recipientEmail: intent.payerEmail, pinCode: result.pin.pinCode,
        studentName: student.name, studentId: student.id, termName,
        pricePaid: Number(intent.amount), paymentRef: reference, slug: student.tenant.slug,
      });
    } catch { console.warn('[PIN stock sale] Receipt email dispatch failed.'); }
    const guardianInfo = (student.guardianContactInfo as Record<string, unknown> | null) || {};
    const parentPhone = guardianInfo.guardianPhone || guardianInfo.phone || guardianInfo.phoneNumber;
    if (typeof parentPhone === 'string' && parentPhone) {
      try {
        const { sendPinPurchaseSms } = await import('./sms-service');
        await sendPinPurchaseSms({
          tenantId, studentName: student.name, parentPhone, schoolName: student.tenant.name,
          termName, pinCode: result.pin.pinCode, checkUrl: `/${student.tenant.slug}/results/check`,
        });
      } catch { console.warn('[PIN stock sale] Receipt SMS dispatch failed.'); }
    }
  }

  return { success: true, pin: result.pin, alreadyProcessed: !result.newlyAssigned };
}

/**
 * Single shared authorization check (§6.1):
 * 1. Checks if student has outstanding school fees. If yes, blocks access & provides clearance info.
 * 2. Validates PIN code against both GeneratedPin (physical scratch cards) & ResultPIN (digital).
 * 3. Enforces 5-use limit and student-binding security.
 */
export async function verifyPinAccess(
  tenantId: string,
  studentId: string,
  termId: string,
  pinCode?: string,
  options?: { consumeUse?: boolean }
): Promise<VerifyPinResult> {
  const consumeUse = options?.consumeUse !== false;
  const activeSessionCutoff = new Date(Date.now() - 15 * 60 * 1000);
  const cleanStudentIdentifier = studentId.trim();

  // 1. Verify student and tenant exist (supports either primary key ID or official admissionNumber)
  const [student, tenant] = await Promise.all([
    findStudentByIdOrAdmissionNo(tenantId, cleanStudentIdentifier),
    prisma.tenant.findUnique({
      where: { id: tenantId },
    }),
  ]);

  if (!student || student.tenantId !== tenantId || !tenant) {
    return { isUnlocked: false, reason: 'Student not found or unauthorized' };
  }

  // Canonicalize studentId to database primary key id for relational integrity
  const canonicalStudentId = student.id;
  const studentInfo = {
    id: student.id,
    name: student.name,
    admissionNumber: student.admissionNumber,
  };

  // 2. Ironclad School Fees Clearance Gate:
  // Any student with an unpaid fee balance is blocked from viewing results even if they have a valid PIN
  if (tenant.blockResultOnFeeBalance) {
    try {
      const feeBalance = await calculateStudentFeeBalance(tenantId, canonicalStudentId, termId);
      if (feeBalance.balanceRemaining > 0) {
        return {
          isUnlocked: false,
          reason: 'fees_outstanding',
          error: `Outstanding school fees of ₦${feeBalance.balanceRemaining.toLocaleString()} must be cleared before accessing results.`,
          balanceRemaining: feeBalance.balanceRemaining,
          totalAssigned: feeBalance.totalAssigned,
          totalPaid: feeBalance.totalPaid,
          feeBreakdown: feeBalance.feeItems,
          bankDetails: {
            bankName: tenant.bankName,
            bankAccountNumber: tenant.bankAccountNumber,
            bankAccountName: tenant.bankAccountName,
          },
          hasOnlinePayment: tenant.hasOnlinePayment ?? true,
          student: studentInfo,
        };
      }
    } catch (feeErr) {
      console.warn('[Fee balance check error during PIN verification]', feeErr);
      // If fee items are not configured yet, proceed gracefully
    }
  }

  // 3. If a PIN code is passed directly, attempt redemption/activation
  if (pinCode) {
    const rawClean = pinCode.trim().toUpperCase();
    const formattedWithDashes =
      rawClean.includes('-')
        ? rawClean
        : rawClean.length === 12
        ? `${rawClean.slice(0, 4)}-${rawClean.slice(4, 8)}-${rawClean.slice(8, 12)}`
        : rawClean;

    // Check Physical Scratch Card (GeneratedPin)
    const physicalPin = await prisma.generatedPin.findFirst({
      where: {
        tenantId,
        OR: [{ pinCode: formattedWithDashes }, { pinCode: rawClean }, { serialNumber: rawClean }],
      },
      include: {
        batch: true,
      },
    });

    if (physicalPin) {
      const maxUses = physicalPin.batch?.maxUsesPerPin || 5;

      if ((physicalPin.onlineSaleReference || physicalPin.studentId) && !physicalPin.soldAt) {
        return {
          isUnlocked: false,
          reason: 'This PIN is reserved for a payment that has not been confirmed yet. Please try again shortly.',
          error: 'This PIN is reserved for a payment that has not been confirmed yet. Please try again shortly.',
          student: studentInfo,
        };
      }

      // Anti-Sharing Security: If already registered to another student
      if (physicalPin.studentId && physicalPin.studentId !== canonicalStudentId) {
        return {
          isUnlocked: false,
          reason: 'This Result PIN is already registered to another student and cannot be reused.',
          error: 'This Result PIN is already registered to another student and cannot be reused.',
          student: studentInfo,
        };
      }
      if (physicalPin.termId && physicalPin.termId !== termId) {
        return { isUnlocked: false, reason: 'This scratch card is already registered for a different term.', error: 'This scratch card is already registered for a different term.', student: studentInfo };
      }

      // If this PIN was already consumed for this student within the last 15 minutes (same viewing session), do not double-deduct
      if (physicalPin.studentId === canonicalStudentId && physicalPin.termId === termId) {
        const recentUsage = await prisma.pinUsage.findFirst({
          where: {
            pinId: physicalPin.id,
            studentId: canonicalStudentId,
            usedAt: { gte: activeSessionCutoff },
          },
        });
        if (recentUsage) {
          return {
            isUnlocked: true,
            pin: physicalPin,
            pinType: 'scratch_card',
            usesRemaining: Math.max(0, maxUses - physicalPin.usesCount),
            student: studentInfo,
          };
        }
      }

      // Check usage ceiling
      if (physicalPin.usesCount >= maxUses) {
        return {
          isUnlocked: false,
          reason: `This scratch card has reached its maximum allowable limit of ${maxUses} result view sessions.`,
          error: `This scratch card has reached its maximum allowable limit of ${maxUses} result view sessions.`,
          student: studentInfo,
        };
      }

      // Bind to student and term, increment usesCount
      const updated = await prisma.$transaction(async (tx) => {
        const consumed = await tx.generatedPin.updateMany({
          where: {
            id: physicalPin.id,
            usesCount: { lt: maxUses },
            OR: [{ studentId: null }, { studentId: canonicalStudentId }],
            AND: [{ OR: [{ termId: null }, { termId }] }],
          },
          data: { studentId: canonicalStudentId, termId, isUsed: true, usesCount: { increment: 1 } },
        });
        if (consumed.count !== 1) return null;
        await tx.pinUsage.create({ data: { pinId: physicalPin.id, studentId: canonicalStudentId } });
        return tx.generatedPin.findUnique({ where: { id: physicalPin.id } });
      });
      if (!updated) {
        return { isUnlocked: false, reason: `This scratch card has reached its maximum allowable limit of ${maxUses} result view sessions.`, student: studentInfo };
      }

      return {
        isUnlocked: true,
        pin: updated,
        pinType: 'scratch_card',
        usesRemaining: Math.max(0, maxUses - updated.usesCount),
        student: studentInfo,
      };
    }

    // Check Digital PIN (ResultPIN)
    const digitalPin = await prisma.resultPIN.findUnique({
      where: { code: formattedWithDashes },
    });

    if (digitalPin) {
      if (digitalPin.studentId !== canonicalStudentId || digitalPin.termId !== termId) {
        return { isUnlocked: false, reason: 'Digital PIN is registered to another student or term', student: studentInfo };
      }

      const now = new Date();
      if (now > digitalPin.expiresAt) {
        return { isUnlocked: false, reason: 'PIN code has expired', student: studentInfo };
      }

      const recentDigitalUsage = await prisma.resultPinUsage.findFirst({
        where: {
          resultPinId: digitalPin.id,
          studentId: canonicalStudentId,
          usedAt: { gte: activeSessionCutoff },
        },
      });
      if (recentDigitalUsage) {
        return {
          isUnlocked: true,
          pin: digitalPin,
          pinType: 'digital_pin',
          usesRemaining: Math.max(0, digitalPin.maxUses - digitalPin.usesCount),
          student: studentInfo,
        };
      }

      if (digitalPin.usesCount >= digitalPin.maxUses) {
        return { isUnlocked: false, reason: `This PIN has reached its maximum of ${digitalPin.maxUses} uses.`, student: studentInfo };
      }

      const activatedPin = await prisma.$transaction(async (tx) => {
        const consumed = await tx.resultPIN.updateMany({
          where: {
            id: digitalPin.id,
            usesCount: { lt: digitalPin.maxUses },
            expiresAt: { gt: now },
            status: { in: ['unused', 'active'] },
          },
          data: {
            status: 'active',
            activatedAt: digitalPin.activatedAt || now,
            usesCount: { increment: 1 },
          },
        });
        if (consumed.count !== 1) return null;
        await tx.resultPinUsage.create({ data: { resultPinId: digitalPin.id, studentId: canonicalStudentId } });
        return tx.resultPIN.findUnique({ where: { id: digitalPin.id } });
      });
      if (!activatedPin) {
        return { isUnlocked: false, reason: 'This PIN has expired or reached its maximum number of uses.', student: studentInfo };
      }
      return { isUnlocked: true, pin: activatedPin, pinType: 'digital_pin', usesRemaining: Math.max(0, activatedPin.maxUses - activatedPin.usesCount), student: studentInfo };
    }

    return { isUnlocked: false, reason: 'Invalid PIN code or Serial Number', student: studentInfo };
  }

  // 4. Check if an active/unlocked PIN already exists for (canonicalStudentId, termId)
  // Check physical scratch card
  const existingPhysical = await prisma.generatedPin.findFirst({
    where: {
      tenantId,
      studentId: canonicalStudentId,
      termId,
    },
    include: {
      batch: true,
    },
  });

  if (existingPhysical) {
    const maxUses = existingPhysical.batch?.maxUsesPerPin || 5;
    const recentUsage = await prisma.pinUsage.findFirst({
      where: {
        pinId: existingPhysical.id,
        studentId: canonicalStudentId,
        usedAt: { gte: activeSessionCutoff },
      },
    });
    if (recentUsage || (!consumeUse && existingPhysical.usesCount < maxUses)) {
      return {
        isUnlocked: true,
        pin: existingPhysical,
        pinType: 'scratch_card',
        usesRemaining: Math.max(0, maxUses - existingPhysical.usesCount),
        student: studentInfo,
      };
    }
    if (existingPhysical.usesCount < maxUses) {
      const updated = await prisma.$transaction(async (tx) => {
        const consumed = await tx.generatedPin.updateMany({
          where: { id: existingPhysical.id, usesCount: { lt: maxUses } },
          data: { usesCount: { increment: 1 }, isUsed: true },
        });
        if (consumed.count !== 1) return null;
        await tx.pinUsage.create({ data: { pinId: existingPhysical.id, studentId: canonicalStudentId } });
        return tx.generatedPin.findUnique({ where: { id: existingPhysical.id } });
      });
      if (updated) {
        return {
          isUnlocked: true,
          pin: updated,
          pinType: 'scratch_card',
          usesRemaining: Math.max(0, maxUses - updated.usesCount),
          student: studentInfo,
        };
      }
    }
  }

  // Check digital PIN
  const activeDigital = await prisma.resultPIN.findFirst({
    where: {
      studentId: canonicalStudentId,
      termId,
      status: 'active',
      expiresAt: { gt: new Date() },
    },
  });

  if (activeDigital) {
    const recentDigitalUsage = await prisma.resultPinUsage.findFirst({
      where: {
        resultPinId: activeDigital.id,
        studentId: canonicalStudentId,
        usedAt: { gte: activeSessionCutoff },
      },
    });
    if (recentDigitalUsage || (!consumeUse && activeDigital.usesCount < activeDigital.maxUses)) {
      return {
        isUnlocked: true,
        pin: activeDigital,
        pinType: 'digital_pin',
        usesRemaining: Math.max(0, activeDigital.maxUses - activeDigital.usesCount),
        student: studentInfo,
      };
    }
    if (activeDigital.usesCount < activeDigital.maxUses) {
      const updatedDigital = await prisma.$transaction(async (tx) => {
        const consumed = await tx.resultPIN.updateMany({
          where: {
            id: activeDigital.id,
            usesCount: { lt: activeDigital.maxUses },
            expiresAt: { gt: new Date() },
            status: 'active',
          },
          data: { usesCount: { increment: 1 } },
        });
        if (consumed.count !== 1) return null;
        await tx.resultPinUsage.create({ data: { resultPinId: activeDigital.id, studentId: canonicalStudentId } });
        return tx.resultPIN.findUnique({ where: { id: activeDigital.id } });
      });
      if (updatedDigital) {
        return {
          isUnlocked: true,
          pin: updatedDigital,
          pinType: 'digital_pin',
          usesRemaining: Math.max(0, updatedDigital.maxUses - updatedDigital.usesCount),
          student: studentInfo,
        };
      }
    }
  }

  return {
    isUnlocked: false,
    reason: 'A valid Result PIN is required to view results for this term.',
    student: studentInfo,
  };
}

/**
 * Explicitly redeems an unused PIN code for a student & term.
 */
export async function redeemPin(
  tenantId: string,
  pinCode: string,
  studentId: string,
  termId: string
): Promise<{ success: boolean; pin?: any; reason?: string }> {
  const result = await verifyPinAccess(tenantId, studentId, termId, pinCode);
  if (!result.isUnlocked) {
    return { success: false, reason: result.reason };
  }
  return { success: true, pin: result.pin };
}

/**
 * Initializes a PIN purchase transaction reference and fee breakdown.
 */
export async function initializePinPurchase(options: {
  tenantId: string;
  studentId: string;
  termId: string;
  customerEmail: string;
}) {
  const { tenantId, studentId, termId, customerEmail } = options;
  const cleanStudentIdentifier = studentId.trim();

  const student = await findStudentByIdOrAdmissionNo(tenantId, cleanStudentIdentifier, {
    include: { tenant: true },
  });

  if (!student || student.tenantId !== tenantId) {
    throw new Error('Student not found or unauthorized');
  }

  const term = await prisma.term.findUnique({
    where: { id: termId },
  });

  if (!term) {
    throw new Error('Term not found');
  }

  const feeCalc = await calculatePinFees(tenantId);
  const paymentRef = `PIN-PAY-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

  return {
    paymentRef,
    pricePaid: feeCalc.pricePaid,
    platformFee: feeCalc.platformFee,
    schoolNet: feeCalc.schoolNet,
    customerEmail,
    studentId: student.id,
    termId,
    tenantId,
    currency: 'NGN',
  };
}

/**
 * Issues a Result PIN upon verified payment gateway webhook receipt (§6, §11.4).
 */
export async function issuePinForPayment(options: {
  tenantId: string;
  studentId: string;
  termId: string;
  paymentRef: string;
  pricePaid?: number;
  customerEmail?: string;
}): Promise<any> {
  const { tenantId, studentId, termId, paymentRef, customerEmail } = options;
  const cleanStudentIdentifier = studentId.trim();

  // 1. Check idempotency (prevent double PIN creation for same transaction)
  const existingPin = await prisma.resultPIN.findFirst({
    where: { paymentRef },
  });

  if (existingPin) {
    return existingPin;
  }

  // 2. Resolve student
  const student = await findStudentByIdOrAdmissionNo(tenantId, cleanStudentIdentifier, {
    include: { tenant: { select: { slug: true, name: true } } },
  });

  if (!student) {
    throw new Error('Student not found or unauthorized');
  }

  const canonicalStudentId = student.id;

  // 3. Resolve term to calculate expiry date (term.endDate + 30 days grace period)
  const term = await prisma.term.findUnique({
    where: { id: termId },
    include: { session: true },
  });

  if (!term) {
    throw new Error('Term not found');
  }

  const gracePeriodDays = 30;
  const now = new Date();
  const termEndDate = term.endDate || now;
  const calculatedExpiry = new Date(termEndDate.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000);
  const expiresAt = calculatedExpiry > now ? calculatedExpiry : new Date(now.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000);

  // 4. Compute revenue split
  const feeCalc = await calculatePinFees(tenantId);
  const actualPricePaid = options.pricePaid ?? feeCalc.pricePaid;
  const platformFee = Math.round(actualPricePaid * (feeCalc.platformFeePercent / 100) * 100) / 100;
  const schoolNet = Math.round((actualPricePaid - platformFee) * 100) / 100;

  // 5. Generate cryptographically unique PIN code
  const code = await generatePinCode();

  // 6. Create ResultPIN record in database
  const pin = await prisma.resultPIN.create({
    data: {
      studentId: canonicalStudentId,
      termId,
      code,
      pricePaid: actualPricePaid,
      platformFee,
      schoolNet,
      paymentRef,
      status: 'unused',
      expiresAt,
    },
  });

  // 7. Automatically dispatch PIN receipt email to guardian/customer if email provided
  const emailRecipient = customerEmail;
  if (emailRecipient && emailRecipient.includes('@')) {
    try {
      const termName = `${term.session?.label || ''} ${term.name}`.trim();

      await sendResultPinPurchaseEmail({
        tenantId,
        recipientEmail: emailRecipient.trim(),
        pinCode: code,
        studentName: student?.name || 'Student',
        studentId: canonicalStudentId,
        termName,
        pricePaid: actualPricePaid,
        paymentRef,
        slug: student?.tenant?.slug || '',
      });
    } catch (emailErr) {
      console.warn('[issuePinForPayment Email Dispatch Warning]', emailErr);
    }
  }

  // 8. Automatically dispatch PIN receipt SMS to guardian phone if available
  const guardianInfo = (student?.guardianContactInfo as any) || {};
  const parentPhone = guardianInfo.guardianPhone || guardianInfo.phone || guardianInfo.phoneNumber;
  if (parentPhone) {
    try {
      const { sendPinPurchaseSms } = await import('./sms-service');
      const termName = `${term.session?.label || ''} ${term.name}`.trim();
      const schoolName = student?.tenant?.name || 'School';
      const checkUrl = `/${student?.tenant?.slug || 'school'}/results/check`;

      await sendPinPurchaseSms({
        tenantId,
        studentName: student?.name || 'Student',
        parentPhone,
        schoolName,
        termName,
        pinCode: code,
        checkUrl,
      });
    } catch (smsErr) {
      console.warn('[issuePinForPayment SMS Dispatch Warning]', smsErr);
    }
  }

  return pin;
}

/**
 * Validates gateway webhook signature and processes PIN fulfillment.
 */
export async function processPaymentWebhook(
  provider: 'paystack' | 'flutterwave',
  rawPayload: string,
  signatureHeader: string | null
): Promise<{ success: boolean; pin?: any; reason?: string }> {
  if (!verifyWebhookSignature(provider, rawPayload, signatureHeader)) {
    return { success: false, reason: `Invalid ${provider} webhook signature` };
  }

  let payload: any;
  try {
    payload = JSON.parse(rawPayload);
  } catch {
    return { success: false, reason: 'Invalid webhook JSON payload' };
  }

  // 2. Extract transaction metadata & event type
  const event = payload?.event || payload?.['event.type'] || 'charge.success';
  if (event !== 'charge.success' && payload?.status !== 'successful') {
    return { success: false, reason: 'Payment event was not successful' };
  }

  const metadata = payload?.data?.metadata || payload?.meta || payload?.metadata;
  if (!metadata || metadata.type !== 'pin_purchase') {
    return { success: false, reason: 'Webhook payload missing pin_purchase metadata' };
  }

  const { tenantId, studentId, termId } = metadata;
  const paymentRef = payload?.data?.reference || payload?.data?.tx_ref || payload?.tx_ref || `REF-${Date.now()}`;
  const amountPaid = (payload?.data?.amount || payload?.amount) / (provider === 'paystack' ? 100 : 1);
  const customerEmail = payload?.data?.customer?.email || metadata.customerEmail || metadata.email;

  if (!tenantId || !studentId || !termId) {
    return { success: false, reason: 'Missing tenantId, studentId, or termId in metadata' };
  }

  // 3. Issue PIN and email to parent
  const pin = await issuePinForPayment({
    tenantId,
    studentId,
    termId,
    paymentRef,
    pricePaid: amountPaid > 0 ? amountPaid : undefined,
    customerEmail,
  });

  return { success: true, pin };
}
