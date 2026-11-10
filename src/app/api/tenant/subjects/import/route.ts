import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';

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
      return NextResponse.json({ error: 'Forbidden: Only school administrators can import subjects' }, { status: 403 });
    }

    const body = await req.json();
    const rows = Array.isArray(body?.subjects) ? body.subjects : [];
    if (rows.length === 0) {
      return NextResponse.json({ error: 'No subject records provided in payload' }, { status: 400 });
    }

    let importedCount = 0;
    const errors: string[] = [];

    // Find existing subjects to avoid duplicates
    const existing = await prisma.subject.findMany({
      where: { tenantId: tenant.id },
      select: { name: true },
    });
    const existingNames = new Set(existing.map((s) => s.name.toLowerCase().trim()));

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const name = String(row.name || row.subjectName || '').trim();
        if (!name) {
          errors.push(`Row ${i + 1}: Subject name is missing`);
          continue;
        }

        const normalizedName = name.toLowerCase();
        if (existingNames.has(normalizedName)) {
          // Skip already configured subject
          continue;
        }

        await tx.subject.create({
          data: {
            tenantId: tenant.id,
            name,
          },
        });

        existingNames.add(normalizedName);
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
    console.error('[Subjects Bulk Import Error]', error);
    return NextResponse.json({ error: error.message || 'Failed to import subjects' }, { status: 500 });
  }
}
