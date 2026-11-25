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
    if (auth.user.role !== 'school_admin') {
      return NextResponse.json({ error: 'Only school administrators can edit ID card records.' }, { status: 403 });
    }

    const body = await req.json();
    const { kind, id, photoUrl, phone, bloodGroup, dob, email } = body as {
      kind?: 'staff' | 'student';
      id?: string;
      photoUrl?: string | null;
      phone?: string | null;
      bloodGroup?: string | null;
      dob?: string | null;
      email?: string | null;
    };

    if (!id || (kind !== 'staff' && kind !== 'student')) {
      return NextResponse.json({ error: 'Valid kind (staff or student) and record id are required.' }, { status: 400 });
    }

    const cleanStr = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
    const patch = {
      avatarUrl: cleanStr(photoUrl),
      phone: cleanStr(phone),
      bloodGroup: cleanStr(bloodGroup),
      dob: cleanStr(dob),
      email: cleanStr(email),
    };

    if (kind === 'staff') {
      const staff = await prisma.staff.findFirst({
        where: { id, tenantId: auth.user.tenantId },
      });
      if (!staff) {
        return NextResponse.json({ error: 'Staff member not found.' }, { status: 404 });
      }
      const existing = (staff.contactInfo as Record<string, any>) || {};
      await prisma.staff.update({
        where: { id: staff.id },
        data: {
          contactInfo: {
            ...existing,
            ...patch,
          },
        },
      });
    } else {
      const student = await prisma.student.findFirst({
        where: { id, tenantId: auth.user.tenantId },
      });
      if (!student) {
        return NextResponse.json({ error: 'Student not found.' }, { status: 404 });
      }
      const existing = (student.guardianContactInfo as Record<string, any>) || {};
      await prisma.student.update({
        where: { id: student.id },
        data: {
          guardianContactInfo: {
            ...existing,
            ...patch,
          },
        },
      });
    }

    await recordAuditLog({
      tenantId: auth.user.tenantId,
      actorId: auth.user.id,
      actorName: auth.user.staffProfile?.name || auth.user.username,
      actorRole: auth.user.role,
      action: 'ID_CARD_PROFILE_UPDATED',
      entityType: kind === 'staff' ? 'Staff' : 'Student',
      entityId: id,
      details: { kind, hasPhoto: Boolean(patch.avatarUrl), bloodGroup: patch.bloodGroup },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true, updated: patch });
  } catch (error: any) {
    console.error('[PATCH /api/tenant/id-cards]', error);
    return NextResponse.json({ error: error?.message || 'Failed to update ID card details.' }, { status: 500 });
  }
}
