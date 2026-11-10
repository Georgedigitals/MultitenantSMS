import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { StaffRole } from '@prisma/client';

export async function POST(req: NextRequest) {
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
      return NextResponse.json({ error: 'Forbidden: Only school administrators can import staff' }, { status: 403 });
    }

    const body = await req.json();
    const rows = Array.isArray(body?.staff) ? body.staff : [];
    if (rows.length === 0) {
      return NextResponse.json({ error: 'No staff records provided in payload' }, { status: 400 });
    }

    let importedCount = 0;
    const errors: string[] = [];

    const validRoles = new Set(Object.values(StaffRole));

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const name = String(row.name || row.staffName || '').trim();
        if (!name) {
          errors.push(`Row ${i + 1}: Staff name is missing`);
          continue;
        }

        const rawRole = String(row.role || row.roleBase || 'teacher').toLowerCase().trim();
        const roleBase = validRoles.has(rawRole as any) ? (rawRole as StaffRole) : StaffRole.teacher;

        const phone = row.phone ? String(row.phone).trim() : null;
        const email = row.email ? String(row.email).trim() : null;

        await tx.staff.create({
          data: {
            tenantId: tenant.id,
            name,
            roleBase,
            contactInfo: {
              phone,
              email,
            },
          },
        });

        importedCount++;
      }
    });

    return NextResponse.json({
      success: true,
      importedCount,
      totalRows: rows.length,
      errors,
    });
  } catch (error: any) {
    console.error('[Staff Bulk Import Error]', error);
    return NextResponse.json({ error: error.message || 'Failed to import staff' }, { status: 500 });
  }
}
