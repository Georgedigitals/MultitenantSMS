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
    if (auth.user.role !== 'school_admin' && auth.user.role !== 'teacher') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const cleanStr = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
    const fullName = cleanStr(body.name);
    const signatureUrl = body.signatureUrl !== undefined ? cleanStr(body.signatureUrl) : undefined;
    const patch = {
      avatarUrl: cleanStr(body.avatarUrl),
      phone: cleanStr(body.phone),
      bloodGroup: cleanStr(body.bloodGroup),
      dob: cleanStr(body.dob),
      email: cleanStr(body.email),
    };

    const staffRecord = await prisma.$transaction(async (tx) => {
      if (auth.user.staffId) {
        const existingStaff = await tx.staff.findFirst({
          where: { id: auth.user.staffId, tenantId: auth.user.tenantId },
        });
        if (existingStaff) {
          const existingInfo = (existingStaff.contactInfo as Record<string, any>) || {};
          return tx.staff.update({
            where: { id: existingStaff.id },
            data: {
              ...(fullName ? { name: fullName } : {}),
              ...(signatureUrl !== undefined ? { signatureUrl } : {}),
              contactInfo: {
                ...existingInfo,
                ...patch,
              },
            },
          });
        }
      }

      // Create and link a Staff record so the School Admin automatically appears on Staff ID Cards
      const created = await tx.staff.create({
        data: {
          tenantId: auth.user.tenantId,
          name: fullName || auth.user.username,
          roleBase: auth.user.role === 'school_admin' ? 'admin' : 'teacher',
          signatureUrl: signatureUrl ?? null,
          contactInfo: patch,
        },
      });
      await tx.tenantUser.update({
        where: { id: auth.user.id },
        data: { staffId: created.id },
      });
      return created;
    });

    await recordAuditLog({
      tenantId: auth.user.tenantId,
      actorId: auth.user.id,
      actorName: staffRecord.name,
      actorRole: auth.user.role,
      action: 'STAFF_SELF_PROFILE_UPDATED',
      entityType: 'Staff',
      entityId: staffRecord.id,
      details: { hasPhoto: Boolean(patch.avatarUrl), bloodGroup: patch.bloodGroup },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true, staffId: staffRecord.id, profile: patch });
  } catch (error: any) {
    console.error('[PATCH /api/tenant/profile]', error);
    return NextResponse.json({ error: error?.message || 'Failed to save profile.' }, { status: 500 });
  }
}
