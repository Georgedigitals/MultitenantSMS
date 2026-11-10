import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSuperAdminFromCookies } from '@/lib/auth/super-admin-auth';

export async function GET(req: NextRequest) {
  try {
    const auth = await getSuperAdminFromCookies();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = req.nextUrl.searchParams.get('tenantId');
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId query parameter is required' }, { status: 400 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        plan: true,
        lowestClassLevel: true,
        highestClassLevel: true,
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Gather full tenant archive data
    const [
      students,
      staff,
      sessions,
      siteContent,
      galleryImages,
      assessmentComponents,
      gradingScales,
      domainAliases,
      pinsCount,
    ] = await Promise.all([
      prisma.student.findMany({
        where: { tenantId },
        include: {
          enrollments: {
            include: {
              classLevel: true,
            },
          },
        },
      }),
      prisma.staff.findMany({
        where: { tenantId },
      }),
      prisma.academicSession.findMany({
        where: { tenantId },
        include: {
          terms: true,
        },
      }),
      prisma.siteContent.findMany({
        where: { tenantId },
      }),
      prisma.galleryImage.findMany({
        where: { tenantId },
      }),
      prisma.assessmentComponent.findMany({
        where: { tenantId },
      }),
      prisma.gradingScale.findMany({
        where: { tenantId },
      }),
      prisma.domainAlias.findMany({
        where: { tenantId },
      }),
      prisma.resultPIN.count({
        where: { student: { tenantId } },
      }),
    ]);

    const archiveData = {
      exportedAt: new Date().toISOString(),
      exportedBy: auth.superAdmin?.id || 'super_admin',
      school: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        archivedAt: tenant.archivedAt,
        createdAt: tenant.createdAt,
        plan: tenant.plan.name,
        branding: tenant.branding,
      },
      summary: {
        totalStudents: students.length,
        totalStaff: staff.length,
        totalAcademicSessions: sessions.length,
        totalPINsGenerated: pinsCount,
        totalGalleryImages: galleryImages.length,
      },
      data: {
        domainAliases,
        siteContent,
        galleryImages,
        assessmentComponents,
        gradingScales,
        sessions,
        staff,
        students,
      },
    };

    const fileName = `school_archive_${tenant.slug}_${Date.now()}.json`;

    return new NextResponse(JSON.stringify(archiveData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    console.error('Export tenant error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to export tenant snapshot' },
      { status: 500 }
    );
  }
}
