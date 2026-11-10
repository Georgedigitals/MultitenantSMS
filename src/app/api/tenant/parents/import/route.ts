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
      return NextResponse.json({ error: 'Forbidden: Only school administrators can import parents' }, { status: 403 });
    }

    const body = await req.json();
    const rows = Array.isArray(body?.parents) ? body.parents : [];
    if (rows.length === 0) {
      return NextResponse.json({ error: 'No parent records provided in payload' }, { status: 400 });
    }

    // Load students for this tenant to link wards
    const students = await prisma.student.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, name: true },
    });
    const studentMap = new Map<string, string>();
    for (const s of students) {
      studentMap.set(s.name.toLowerCase().trim(), s.id);
    }

    let importedCount = 0;
    const errors: string[] = [];

    await prisma.$transaction(async (tx: any) => {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const guardianName = String(row.guardianName || row.name || '').trim();
        if (!guardianName) {
          errors.push(`Row ${i + 1}: Parent/guardian name is missing`);
          continue;
        }

        const relationship = row.relationship ? String(row.relationship).trim() : 'Parent / Guardian';
        const phone = row.phone ? String(row.phone).trim() : null;
        const email = row.email ? String(row.email).trim() : null;
        const address = row.address ? String(row.address).trim() : null;
        const studentName = row.studentName ? String(row.studentName).trim().toLowerCase() : null;

        const guardian = await tx.guardian.create({
          data: {
            tenantId: tenant.id,
            name: guardianName,
            relationship,
            contactInfo: { phone, email, address },
          },
        });

        // Link to student if ward name was specified and matches
        if (studentName && studentMap.has(studentName)) {
          const studentId = studentMap.get(studentName)!;
          await tx.studentGuardian.create({
            data: {
              studentId,
              guardianId: guardian.id,
              isPrimaryContact: true,
            },
          });

          // Also update student's guardianContactInfo for backward compatibility
          await tx.student.update({
            where: { id: studentId },
            data: {
              guardianContactInfo: {
                guardianName,
                relationship,
                phone,
                email,
                address,
              },
            },
          });
        }

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
    console.error('[Parents Bulk Import Error]', error);
    return NextResponse.json({ error: error.message || 'Failed to import parents' }, { status: 500 });
  }
}
