import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSuperAdminFromCookies } from '@/lib/auth/super-admin-auth';

/**
 * POST /api/admin/tenants/import
 * Import a full NDPR/JSON snapshot archive into a new school tenant instance.
 */
export async function POST(req: NextRequest) {
  const auth = await getSuperAdminFromCookies();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { snapshot, overrideName, overrideSlug, planId } = body;

    if (!snapshot || typeof snapshot !== 'object') {
      return NextResponse.json({ error: 'Valid JSON snapshot payload is required' }, { status: 400 });
    }

    const sourceTenant = snapshot.school || snapshot.tenant || snapshot;
    if (!sourceTenant.name && !overrideName) {
      return NextResponse.json({ error: 'Invalid snapshot format — tenant name missing' }, { status: 400 });
    }

    // Determine target name and slug
    const targetName = overrideName?.trim() || sourceTenant.name || 'Imported School';
    let baseSlug = (overrideSlug?.trim() || sourceTenant.slug || 'school').toLowerCase().replace(/[^a-z0-9-]/g, '-');
    
    // Check if slug exists, generate unique slug if collision
    const existingSlug = await prisma.tenant.findUnique({ where: { slug: baseSlug } });
    if (existingSlug) {
      baseSlug = `${baseSlug}-imp-${Date.now().toString().slice(-5)}`;
    }

    // Default plan fallback
    const defaultPlan = await prisma.plan.findFirst();
    const targetPlanId = planId || sourceTenant.planId || sourceTenant.plan?.id || defaultPlan?.id;

    if (!targetPlanId) {
      return NextResponse.json({ error: 'No subscription plan available for tenant' }, { status: 400 });
    }

    const selectedPlan = await prisma.plan.findUnique({ where: { id: targetPlanId } });
    const now = new Date();
    const annualContractExpiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    // 1. Create Tenant Record
    const newTenant = await prisma.tenant.create({
      data: {
        name: targetName,
        slug: baseSlug,
        planId: targetPlanId,
        annualContractPrice: selectedPlan?.price ?? defaultPlan?.price ?? 0,
        subscriptionStartedAt: now,
        subscriptionExpiresAt: annualContractExpiresAt,
        status: 'active',
        branding: sourceTenant.branding || {
          primaryColor: '#1E3A8A',
          accentColor: '#2563EB',
          logoUrl: null,
          fontHeading: 'Inter',
          fontBody: 'Inter',
        },
        pinPrice: sourceTenant.pinPrice ? Number(sourceTenant.pinPrice) : 1000.0,
      },
    });

    // 2. Auto-provision local domain alias
    await prisma.domainAlias.create({
      data: {
        tenantId: newTenant.id,
        domain: `${baseSlug}.localhost:3000`,
        verifiedAt: new Date(),
        verificationToken: `token_${baseSlug}_import_auto`,
      },
    }).catch(() => {});

    let importedSessionsCount = 0;
    let importedStaffCount = 0;
    let importedStudentsCount = 0;
    let importedSubjectsCount = 0;

    // Resolve data section (handles both snapshot.data and root snapshot)
    const sourceData = snapshot.data || snapshot;

    // 3. Import Academic Sessions & Terms if present
    const sourceSessions = sourceData.sessions || snapshot.academicSessions || [];
    const sessionMap = new Map<string, string>(); // oldSessionId -> newSessionId

    for (const sess of sourceSessions) {
      const newSession = await prisma.academicSession.create({
        data: {
          tenantId: newTenant.id,
          label: sess.label || '2024/2025',
          startDate: sess.startDate ? new Date(sess.startDate) : new Date('2024-09-02'),
          endDate: sess.endDate ? new Date(sess.endDate) : new Date('2025-07-18'),
          isCurrent: Boolean(sess.isCurrent),
        },
      });
      sessionMap.set(sess.id, newSession.id);
      importedSessionsCount++;

      for (const term of sess.terms || []) {
        await prisma.term.create({
          data: {
            sessionId: newSession.id,
            name: term.name,
            startDate: term.startDate ? new Date(term.startDate) : new Date('2024-09-02'),
            endDate: term.endDate ? new Date(term.endDate) : new Date('2024-12-13'),
            isCurrent: Boolean(term.isCurrent),
          },
        }).catch(() => {});
      }
    }

    // 4. Import Staff Roster & TenantUser
    const sourceStaff = sourceData.staff || snapshot.staff || [];
    for (const st of sourceStaff) {
      const newStaff = await prisma.staff.create({
        data: {
          tenantId: newTenant.id,
          name: st.name,
          roleBase: st.roleBase || 'teacher',
          contactInfo: st.contactInfo || null,
        },
      });
      importedStaffCount++;

      // Create login user account
      const username = `staff_${newStaff.id.slice(-6)}@${baseSlug}.edu`;
      await prisma.tenantUser.create({
        data: {
          tenantId: newTenant.id,
          username,
          passwordHash: '$2a$10$e7K9yYn0y4q7zQ0z8A.0u.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1', // Default hashed password
          role: st.roleBase === 'admin' ? 'school_admin' : 'teacher',
          staffId: newStaff.id,
          isActive: true,
        },
      }).catch(() => {});
    }

    // If no staff was imported, create default admin user
    if (importedStaffCount === 0) {
      const adminStaff = await prisma.staff.create({
        data: {
          tenantId: newTenant.id,
          name: `Admin (${targetName})`,
          roleBase: 'admin',
          contactInfo: { email: `admin@${baseSlug}.edu` },
        },
      });
      await prisma.tenantUser.create({
        data: {
          tenantId: newTenant.id,
          username: `admin@${baseSlug}.edu`,
          passwordHash: '$2a$10$e7K9yYn0y4q7zQ0z8A.0u.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1',
          role: 'school_admin',
          staffId: adminStaff.id,
          isActive: true,
        },
      });
    }

    // 5. Import Students
    const sourceStudents = sourceData.students || snapshot.students || [];
    for (const stud of sourceStudents) {
      await prisma.student.create({
        data: {
          tenantId: newTenant.id,
          name: stud.name,
          guardianContactInfo: stud.guardianContactInfo || null,
        },
      });
      importedStudentsCount++;
    }

    // 6. Import Site Contents
    const sourceContents = sourceData.siteContent || sourceData.siteContents || snapshot.siteContents || [];
    for (const sc of sourceContents) {
      await prisma.siteContent.create({
        data: {
          tenantId: newTenant.id,
          page: sc.page || 'home',
          content: sc.content || {},
        },
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      message: `School tenant "${targetName}" imported successfully!`,
      tenant: {
        id: newTenant.id,
        name: newTenant.name,
        slug: newTenant.slug,
        status: newTenant.status,
      },
      stats: {
        sessions: importedSessionsCount,
        staff: importedStaffCount,
        students: importedStudentsCount,
        subjects: importedSubjectsCount,
      },
    });
  } catch (error: any) {
    console.error('Error importing tenant snapshot:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to import tenant snapshot' },
      { status: 500 }
    );
  }
}
