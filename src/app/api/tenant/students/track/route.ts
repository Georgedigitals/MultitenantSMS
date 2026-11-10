import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { findTenantBySlugOrDomain } from '@/lib/tenant';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, studentIds, departmentTrack, electiveSubjectIds } = body as {
      slug: string;
      studentIds: string[];
      departmentTrack: 'science' | 'arts' | 'commercial' | 'general';
      electiveSubjectIds?: string[];
    };

    if (!slug || !Array.isArray(studentIds) || studentIds.length === 0) {
      return NextResponse.json(
        { error: 'slug and an array of studentIds are required' },
        { status: 400 }
      );
    }

    const tenant = await findTenantBySlugOrDomain(slug, { id: true });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const auth = await getTenantUserFromCookies(tenant.id);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!['school_admin', 'teacher'].includes(auth.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify all studentIds belong to this tenant
    const students = await prisma.student.findMany({
      where: {
        id: { in: studentIds },
        tenantId: tenant.id,
      },
      select: {
        id: true,
        guardianContactInfo: true,
      },
    });

    if (students.length === 0) {
      return NextResponse.json({ error: 'No matching students found' }, { status: 404 });
    }

    // Atomic update in an interactive transaction
    await prisma.$transaction(async (tx) => {
      for (const student of students) {
        const currentInfo =
          student.guardianContactInfo && typeof student.guardianContactInfo === 'object'
            ? (student.guardianContactInfo as Record<string, any>)
            : {};

        const updatedInfo: Record<string, any> = {
          ...currentInfo,
          departmentTrack: departmentTrack || 'general',
        };

        if (Array.isArray(electiveSubjectIds)) {
          updatedInfo.electiveSubjectIds = electiveSubjectIds;
        }

        await tx.student.update({
          where: { id: student.id, tenantId: tenant.id },
          data: {
            guardianContactInfo: updatedInfo,
          },
        });
      }
    });

    return NextResponse.json({
      success: true,
      message: `Updated academic track for ${students.length} student(s) successfully`,
      updatedCount: students.length,
    });
  } catch (err: any) {
    console.error('[POST /api/tenant/students/track error]', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to update student academic track' },
      { status: 500 }
    );
  }
}

