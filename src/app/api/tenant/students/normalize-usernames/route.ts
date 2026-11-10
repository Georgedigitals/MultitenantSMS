import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';
    if (!slug) return NextResponse.json({ error: 'School slug is required' }, { status: 400 });

    const tenant = await getTenantContext({ slug });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    const auth = await getTenantUserFromCookies(tenant.id);
    if (!auth || auth.user.role !== 'school_admin') {
      return NextResponse.json({ error: 'Only a school administrator can update student login names' }, { status: 403 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const students = await tx.student.findMany({
        where: { tenantId: tenant.id },
        select: {
          id: true,
          admissionNumber: true,
          guardianContactInfo: true,
          userAccount: { select: { id: true, username: true } },
        },
      });
      let updated = 0;
      let skipped = 0;

      for (const student of students) {
        const account = student.userAccount;
        const guardian = (student.guardianContactInfo as Record<string, unknown> | null) || {};
        const admissionNumber = String(student.admissionNumber || guardian.admissionNo || '').trim();
        if (!account || !admissionNumber) {
          skipped += 1;
          continue;
        }

        let username = admissionNumber.toLowerCase();
        let collision = await tx.tenantUser.findUnique({
          where: { tenantId_username: { tenantId: tenant.id, username } },
          select: { id: true },
        });
        if (collision && collision.id !== account.id) {
          username = `${admissionNumber.toLowerCase()}@${tenant.slug}.edu`;
          collision = await tx.tenantUser.findUnique({
            where: { tenantId_username: { tenantId: tenant.id, username } },
            select: { id: true },
          });
        }
        if (collision && collision.id !== account.id) {
          username = `student-${randomBytes(6).toString('hex')}@${tenant.slug}.edu`;
        }
        if (account.username !== username) {
          await tx.tenantUser.update({ where: { id: account.id }, data: { username } });
          updated += 1;
        }
      }
      return { updated, skipped };
    });

    return NextResponse.json({
      success: true,
      ...result,
      message: `${result.updated} student login name${result.updated === 1 ? '' : 's'} updated. Existing passwords were preserved.`,
    });
  } catch (error: any) {
    console.error('[Normalize student usernames error]', error);
    return NextResponse.json({ error: error?.message || 'Could not update student login names' }, { status: 500 });
  }
}
