import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { findTenantBySlugOrDomain, getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { calculatePinFees } from '@/lib/pin';
import { recordAuditLog } from '@/lib/audit';
import { getClientIp } from '@/lib/rate-limiter';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    if (!slug) {
      return NextResponse.json({ error: 'Tenant slug is required' }, { status: 400 });
    }

    const tenant = await findTenantBySlugOrDomain(slug, undefined, {
        plan: {
          include: { features: true },
        },
        lowestClassLevel: true,
        highestClassLevel: true,
        sessions: {
          orderBy: { startDate: 'desc' },
          include: {
            terms: { orderBy: { startDate: 'asc' } },
          },
        },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const auth = await getTenantUserFromCookies(tenant.id);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allClassLevels = await prisma.classLevel.findMany({
      orderBy: { orderIndex: 'asc' },
    });

    const pinFees = await calculatePinFees(tenant.id);

    return NextResponse.json({
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        status: tenant.status,
        trialEndsAt: tenant.trialEndsAt,
        branding: tenant.branding,
        pinPrice: Number(tenant.pinPrice),
        admissionNumberPrefix: tenant.admissionNumberPrefix,
        blockPromotionOnFeeBalance: tenant.blockPromotionOnFeeBalance,
        blockResultOnFeeBalance: tenant.blockResultOnFeeBalance,
        bankName: tenant.bankName,
        bankAccountNumber: tenant.bankAccountNumber,
        bankAccountName: tenant.bankAccountName,
        hasOnlinePayment: tenant.hasOnlinePayment,
        workStartTime: tenant.workStartTime || '07:30',
        lateThresholdTime: tenant.lateThresholdTime || '07:45',
        workEndTime: tenant.workEndTime || '15:30',
        campusLatitude: tenant.campusLatitude,
        campusLongitude: tenant.campusLongitude,
        campusRadiusMeters: tenant.campusRadiusMeters || 200,
        enableGeofenceAttendance: tenant.enableGeofenceAttendance,
        lowestClassLevel: tenant.lowestClassLevel,
        highestClassLevel: tenant.highestClassLevel,
        plan: {
          name: tenant.plan.name,
          studentCeiling: tenant.plan.studentCeiling,
          pinRequired: tenant.plan.pinRequired,
        },
      },
      sessions: tenant.sessions,
      currentSession: tenant.sessions.find((s: any) => s.isCurrent) || tenant.sessions[0] || null,
      allClassLevels,
      pinFees,
    });
  } catch (error: any) {
    console.error('[Get Settings Error]', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    if (!slug) {
      return NextResponse.json({ error: 'Tenant slug is required' }, { status: 400 });
    }

    const tenant = await getTenantContext({ slug });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const auth = await getTenantUserFromCookies(tenant.id);
    if (!auth || auth.user.role !== 'school_admin') {
      return NextResponse.json({ error: 'Forbidden: Only school administrators can update settings' }, { status: 403 });
    }

    const body = await req.json();
    const {
      name,
      branding,
      pinPrice,
      blockPromotionOnFeeBalance,
      blockResultOnFeeBalance,
      bankName,
      bankAccountNumber,
      bankAccountName,
      hasOnlinePayment,
      workStartTime,
      lateThresholdTime,
      workEndTime,
      campusLatitude,
      campusLongitude,
      campusRadiusMeters,
      enableGeofenceAttendance,
      lowestClassLevelId,
      highestClassLevelId,
      admissionNumberPrefix,
      oldPassword,
      newPassword,
    } = body;

    const updateData: any = {};
    const auditDetails: Record<string, any> = {};

    if (admissionNumberPrefix !== undefined) {
      const prefix = typeof admissionNumberPrefix === 'string' ? admissionNumberPrefix.trim() : '';
      if (prefix && !/^[A-Za-z0-9-]{1,12}$/.test(prefix)) {
        return NextResponse.json({ error: 'Admission number prefix must be 1–12 letters, numbers or hyphens.' }, { status: 400 });
      }
      updateData.admissionNumberPrefix = prefix || null;
      auditDetails.admissionNumberPrefix = prefix || null;
    }

    // 1. School Name
    if (name && typeof name === 'string' && name.trim()) {
      updateData.name = name.trim();
      auditDetails.name = name.trim();
    }

    // 2. Branding Tokens
    if (branding && typeof branding === 'object') {
      const currentBranding = (tenant.branding as any) || {};
      updateData.branding = {
        ...currentBranding,
        ...branding,
      };
      auditDetails.brandingUpdated = true;
    }

    // 3. PIN Price
    if (pinPrice !== undefined && !isNaN(Number(pinPrice)) && Number(pinPrice) >= 0) {
      updateData.pinPrice = Number(pinPrice);
      auditDetails.pinPrice = Number(pinPrice);
    }

    // 4. Block Promotion On Fee Debt
    if (typeof blockPromotionOnFeeBalance === 'boolean') {
      updateData.blockPromotionOnFeeBalance = blockPromotionOnFeeBalance;
      auditDetails.blockPromotionOnFeeBalance = blockPromotionOnFeeBalance;
    }

    // 5. Block Result On Fee Debt
    if (typeof blockResultOnFeeBalance === 'boolean') {
      updateData.blockResultOnFeeBalance = blockResultOnFeeBalance;
      auditDetails.blockResultOnFeeBalance = blockResultOnFeeBalance;
    }

    // 6. School Bank Account Details (for schools without Paystack / manual transfers)
    if (bankName !== undefined) {
      updateData.bankName = typeof bankName === 'string' ? bankName.trim() : null;
    }
    if (bankAccountNumber !== undefined) {
      updateData.bankAccountNumber = typeof bankAccountNumber === 'string' ? bankAccountNumber.trim() : null;
    }
    if (bankAccountName !== undefined) {
      updateData.bankAccountName = typeof bankAccountName === 'string' ? bankAccountName.trim() : null;
    }
    if (typeof hasOnlinePayment === 'boolean') {
      updateData.hasOnlinePayment = hasOnlinePayment;
    }

    // 7. Staff Attendance Policy & Work Hours
    if (workStartTime !== undefined && typeof workStartTime === 'string') {
      updateData.workStartTime = workStartTime.trim();
    }
    if (lateThresholdTime !== undefined && typeof lateThresholdTime === 'string') {
      updateData.lateThresholdTime = lateThresholdTime.trim();
    }
    if (workEndTime !== undefined && typeof workEndTime === 'string') {
      updateData.workEndTime = workEndTime.trim();
    }
    if (campusLatitude !== undefined) {
      updateData.campusLatitude = campusLatitude === null || campusLatitude === '' ? null : Number(campusLatitude);
    }
    if (campusLongitude !== undefined) {
      updateData.campusLongitude = campusLongitude === null || campusLongitude === '' ? null : Number(campusLongitude);
    }
    if (campusRadiusMeters !== undefined && !isNaN(Number(campusRadiusMeters))) {
      updateData.campusRadiusMeters = Number(campusRadiusMeters);
    }
    if (typeof enableGeofenceAttendance === 'boolean') {
      updateData.enableGeofenceAttendance = enableGeofenceAttendance;
    }

    // 5. Class Level Range
    if (lowestClassLevelId !== undefined || highestClassLevelId !== undefined) {
      const allLevels = await prisma.classLevel.findMany({ orderBy: { orderIndex: 'asc' } });
      const targetLowestId = lowestClassLevelId !== undefined ? lowestClassLevelId : tenant.lowestClassLevelId;
      const targetHighestId = highestClassLevelId !== undefined ? highestClassLevelId : tenant.highestClassLevelId;

      const lowestLvl = allLevels.find((l) => l.id === targetLowestId);
      const highestLvl = allLevels.find((l) => l.id === targetHighestId);

      if (lowestLvl && highestLvl && lowestLvl.orderIndex > highestLvl.orderIndex) {
        return NextResponse.json({ error: 'Lowest class level cannot be higher than highest class level' }, { status: 400 });
      }

      if (targetLowestId !== undefined) updateData.lowestClassLevelId = targetLowestId;
      if (targetHighestId !== undefined) updateData.highestClassLevelId = targetHighestId;
      auditDetails.classRange = { lowest: lowestLvl?.name, highest: highestLvl?.name };
    }

    // 6. Admin Password Change
    if (oldPassword && newPassword) {
      if (newPassword.length < 6) {
        return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 });
      }

      const userRecord = await prisma.tenantUser.findUnique({
        where: { id: auth.user.id },
      });

      if (!userRecord) {
        return NextResponse.json({ error: 'Admin account record not found' }, { status: 404 });
      }

      const isValid = await bcrypt.compare(oldPassword, userRecord.passwordHash);
      if (!isValid) {
        return NextResponse.json({ error: 'Current password entered is incorrect' }, { status: 400 });
      }

      const newHash = await bcrypt.hash(newPassword, 10);
      await prisma.tenantUser.update({
        where: { id: userRecord.id },
        data: { passwordHash: newHash },
      });

      auditDetails.passwordChanged = true;
    }

    // Apply tenant updates
    const updatedTenant = await prisma.tenant.update({
      where: { id: tenant.id },
      data: updateData,
    });

    const clientIp = getClientIp(req);
    await recordAuditLog({
      tenantId: tenant.id,
      actorId: auth.user.id,
      actorName: auth.user.staffProfile?.name || auth.user.username,
      actorRole: auth.user.role,
      action: 'SETTINGS_UPDATED',
      entityType: 'Tenant',
      entityId: tenant.id,
      details: auditDetails,
      ipAddress: clientIp,
    });

    return NextResponse.json({
      success: true,
      tenant: updatedTenant,
    });
  } catch (error: any) {
    console.error('[Update Settings Error]', error);
    return NextResponse.json({ error: error.message || 'Failed to update settings' }, { status: 500 });
  }
}
