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
      return NextResponse.json({ error: 'Forbidden: Only school administrators can import students' }, { status: 403 });
    }

    const body = await req.json();
    const rows = Array.isArray(body?.students) ? body.students : [];
    if (rows.length === 0) {
      return NextResponse.json({ error: 'No student records provided in payload' }, { status: 400 });
    }

    const currentSession = tenant.currentSession;
    if (!currentSession) {
      return NextResponse.json({ error: 'No active academic session configured for this school' }, { status: 400 });
    }

    // Load available class levels
    const classLevels = await prisma.classLevel.findMany({
      orderBy: { orderIndex: 'asc' },
    });
    const classMap = new Map<string, string>();
    for (const lvl of classLevels) {
      classMap.set(lvl.name.toLowerCase().trim(), lvl.id);
    }

    // Plan capacity check for bulk import (§studentCeiling limit)
    const studentCeiling = tenant.plan?.studentCeiling ?? 0;
    if (studentCeiling > 0) {
      const currentCount = await prisma.student.count({ where: { tenantId: tenant.id } });
      const validImportCount = rows.filter((r: any) => String(r.name || r.studentName || '').trim().length > 0).length;
      if (currentCount + validImportCount > studentCeiling) {
        return NextResponse.json(
          {
            error: `Importing ${validImportCount} students exceeds your ${tenant.plan?.name || 'current'} plan capacity (${currentCount} active / ${studentCeiling} ceiling). Please upgrade your subscription plan to import this roster.`
          },
          { status: 422 }
        );
      }
    }

    let importedCount = 0;
    const errors: string[] = [];

    // Process students atomically in batches
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const studentName = String(row.name || row.studentName || '').trim();
        const className = String(row.className || row.class || '').trim();

        if (!studentName) {
          errors.push(`Row ${i + 1}: Student name is missing`);
          continue;
        }

        const classLevelId = className ? classMap.get(className.toLowerCase()) : null;

        const guardianContact = {
          guardianName: row.guardianName ? String(row.guardianName).trim() : null,
          relationship: row.relationship ? String(row.relationship).trim() : 'Parent / Guardian',
          phone: row.phone ? String(row.phone).trim() : null,
          email: row.email ? String(row.email).trim() : null,
          address: row.address ? String(row.address).trim() : null,
        };

        const rawAdm = row.admissionNumber || row.admissionNo || row.admNo;
        let admNo = rawAdm ? String(rawAdm).trim() : '';
        if (!admNo) {
          const { generateNextAdmissionNumber } = await import('@/lib/admission-number');
          admNo = await generateNextAdmissionNumber(tenant.id, { prismaClient: tx });
        }

        // Create student with fail-safe resilience
        let student: any;
        try {
          student = await tx.student.create({
            data: {
              tenantId: tenant.id,
              name: studentName,
              admissionNumber: admNo,
              guardianContactInfo: guardianContact,
            },
          });
        } catch (createErr: any) {
          if (String(createErr?.message || '').includes('admissionNumber')) {
            student = await tx.student.create({
              data: {
                tenantId: tenant.id,
                name: studentName,
                guardianContactInfo: guardianContact,
              },
            });
            if (admNo) {
              await tx.$executeRawUnsafe(
                `UPDATE "students" SET "admission_number" = $1 WHERE "id" = $2 AND "tenant_id" = $3`,
                admNo,
                student.id,
                tenant.id
              );
              student.admissionNumber = admNo;
            }
          } else {
            throw createErr;
          }
        }

        // Create enrollment if class level is recognized
        if (classLevelId) {
          await tx.enrollment.create({
            data: {
              studentId: student.id,
              classLevelId,
              sessionId: currentSession.id,
              status: 'active',
            },
          });
        }

        // Create relational Guardian & StudentGuardian if guardian details provided
        if (guardianContact.guardianName || guardianContact.phone || guardianContact.email) {
          const guardian = await tx.guardian.create({
            data: {
              tenantId: tenant.id,
              name: guardianContact.guardianName || `${studentName}'s Guardian`,
              relationship: guardianContact.relationship,
              contactInfo: {
                phone: guardianContact.phone,
                email: guardianContact.email,
                address: guardianContact.address,
              },
            },
          });

          await tx.studentGuardian.create({
            data: {
              studentId: student.id,
              guardianId: guardian.id,
              isPrimaryContact: true,
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
    console.error('[Students Bulk Import Error]', error);
    return NextResponse.json({ error: error.message || 'Failed to import students' }, { status: 500 });
  }
}
