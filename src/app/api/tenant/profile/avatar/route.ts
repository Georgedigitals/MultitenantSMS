import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { recordAuditLog } from '@/lib/audit';
import { getClientIp } from '@/lib/rate-limiter';

export async function PATCH(req: NextRequest) {
  try {
    const auth = await getTenantUserFromCookies();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { avatarUrl } = body;

    if (avatarUrl !== null && avatarUrl !== undefined && typeof avatarUrl !== 'string') {
      return NextResponse.json({ error: 'Invalid avatar URL' }, { status: 400 });
    }

    const cleanAvatarUrl = typeof avatarUrl === 'string' ? avatarUrl.trim() : null;

    // Persist avatar URL into the user's role profile entity
    if (auth.user.staffId) {
      const staff = await prisma.staff.findFirst({
        where: { id: auth.user.staffId, tenantId: auth.user.tenantId },
      });
      if (staff) {
        const contactInfo = (staff.contactInfo as Record<string, any>) || {};
        await prisma.staff.update({
          where: { id: staff.id },
          data: {
            contactInfo: {
              ...contactInfo,
              avatarUrl: cleanAvatarUrl,
            },
          },
        });
      }
    } else if (auth.user.studentId) {
      const student = await prisma.student.findFirst({
        where: { id: auth.user.studentId, tenantId: auth.user.tenantId },
      });
      if (student) {
        const guardianInfo = (student.guardianContactInfo as Record<string, any>) || {};
        await prisma.student.update({
          where: { id: student.id },
          data: {
            guardianContactInfo: {
              ...guardianInfo,
              avatarUrl: cleanAvatarUrl,
            },
          },
        });
      }
    } else {
      // Fallback for parent or other tenant accounts: find associated guardian record if any
      const guardian = await prisma.guardian.findFirst({
        where: { tenantId: auth.user.tenantId },
      });
      if (guardian) {
        const contactInfo = (guardian.contactInfo as Record<string, any>) || {};
        await prisma.guardian.update({
          where: { id: guardian.id },
          data: {
            contactInfo: {
              ...contactInfo,
              avatarUrl: cleanAvatarUrl,
            },
          },
        });
      }
    }

    await recordAuditLog({
      tenantId: auth.user.tenantId,
      actorId: auth.user.id,
      actorName: auth.user.staffProfile?.name || auth.user.studentProfile?.name || auth.user.username,
      actorRole: auth.user.role,
      action: 'AVATAR_UPDATED',
      entityType: 'TenantUser',
      entityId: auth.user.id,
      details: { avatarUrl: cleanAvatarUrl },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({
      success: true,
      avatarUrl: cleanAvatarUrl,
    });
  } catch (error: any) {
    console.error('[Update Avatar Error]', error);
    return NextResponse.json({ error: error.message || 'Failed to update avatar' }, { status: 500 });
  }
}
