import { hashPassword } from '@/lib/auth/passwords';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSuperAdminFromCookies } from '@/lib/auth/super-admin-auth';
import { isReservedSlug, isValidSlugFormat } from '@/lib/tenant';
import { getDefaultTrialDays } from '@/lib/platform-settings';

export async function POST(req: NextRequest) {
  const auth = await getSuperAdminFromCookies();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, slug, planId, status } = body;

    if (!name || !slug || !planId) {
      return NextResponse.json({ error: 'Name, slug, and plan are required' }, { status: 400 });
    }

    const cleanSlug = slug.trim().toLowerCase();

    if (!isValidSlugFormat(cleanSlug)) {
      return NextResponse.json(
        { error: 'Invalid slug format. Must be 3–63 lowercase alphanumeric characters and hyphens.' },
        { status: 400 }
      );
    }

    if (isReservedSlug(cleanSlug)) {
      return NextResponse.json({ error: `The slug '${cleanSlug}' is reserved by the system.` }, { status: 400 });
    }

    const existing = await prisma.tenant.findUnique({ where: { slug: cleanSlug } });
    if (existing) {
      return NextResponse.json({ error: `A school with slug '${cleanSlug}' already exists.` }, { status: 400 });
    }

    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      return NextResponse.json({ error: 'Selected subscription plan does not exist.' }, { status: 400 });
    }

    const now = new Date();
    const annualContractExpiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    const tenant = await prisma.tenant.create({
      data: {
        name,
        slug: cleanSlug,
        planId,
        annualContractPrice: plan.price,
        subscriptionStartedAt: now,
        subscriptionExpiresAt: annualContractExpiresAt,
        status: status || 'trial',
        trialEndsAt: (status || 'trial') === 'trial'
          ? new Date(Date.now() + (await getDefaultTrialDays()) * 24 * 60 * 60 * 1000)
          : null,
        branding: {
          primaryColor: '#1E3A8A',
          accentColor: '#2563EB',
          logoUrl: null,
          fontHeading: 'Inter',
          fontBody: 'Inter',
        },
      },
      include: {
        plan: true,
      },
    });

    // Auto-provision DomainAlias only in local development
    const rootDomain = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000').toLowerCase();
    if (rootDomain.includes('localhost')) {
      await prisma.domainAlias.create({
        data: {
          tenantId: tenant.id,
          domain: `${cleanSlug}.localhost:3000`,
          verifiedAt: new Date(),
          verificationToken: `token_${cleanSlug}_sa_auto`,
        },
      }).catch(() => {});
    }

    // Auto-provision Initial Academic Session (2024/2025) & Terms
    const session = await prisma.academicSession.create({
      data: {
        tenantId: tenant.id,
        label: '2024/2025',
        startDate: new Date('2024-09-02'),
        endDate: new Date('2025-07-18'),
        isCurrent: true,
      },
    });

    await prisma.term.create({
      data: {
        sessionId: session.id,
        name: '1st Term',
        startDate: new Date('2024-09-02'),
        endDate: new Date('2024-12-13'),
        isCurrent: true,
      },
    });

    await prisma.term.createMany({
      data: [
        { sessionId: session.id, name: '2nd Term', startDate: new Date('2025-01-06'), endDate: new Date('2025-04-11'), isCurrent: false },
        { sessionId: session.id, name: '3rd Term', startDate: new Date('2025-04-28'), endDate: new Date('2025-07-18'), isCurrent: false },
      ],
    });

    // Auto-provision Default Assessment Components (1st CA 20%, 2nd CA 20%, Exam 60%)
    await prisma.assessmentComponent.createMany({
      data: [
        { tenantId: tenant.id, termId: null, name: '1st CA', maxScore: 20, weightPercent: 20.0, orderIndex: 1 },
        { tenantId: tenant.id, termId: null, name: '2nd CA', maxScore: 20, weightPercent: 20.0, orderIndex: 2 },
        { tenantId: tenant.id, termId: null, name: 'Exam', maxScore: 60, weightPercent: 60.0, orderIndex: 3 },
      ],
    });

    // Auto-provision Default Admin Staff & TenantUser Account
    const defaultPassword = body.adminPassword || `${cleanSlug.charAt(0).toUpperCase() + cleanSlug.slice(1)}Admin123!`;
    const defaultPasswordHash = await hashPassword(defaultPassword);

    const staff = await prisma.staff.create({
      data: {
        tenantId: tenant.id,
        name: body.adminName || `Admin (${name})`,
        roleBase: 'admin',
        contactInfo: { email: body.adminEmail || `admin@${cleanSlug}.edu` },
      },
    });

    await prisma.tenantUser.create({
      data: {
        tenantId: tenant.id,
        username: body.adminEmail || `admin@${cleanSlug}.edu`,
        passwordHash: defaultPasswordHash,
        role: 'school_admin',
        staffId: staff.id,
        isActive: true,
      },
    });

    const initialAdminEmail = (body.adminEmail || `admin@${cleanSlug}.edu`).trim();
    await prisma.emailConfiguration.upsert({
      where: { tenantId: tenant.id },
      create: {
        tenantId: tenant.id,
        host: '',
        port: 465,
        secure: true,
        user: '',
        pass: '',
        fromName: name,
        fromEmail: initialAdminEmail,
        replyTo: initialAdminEmail,
        verified: false,
      },
      update: {
        fromName: name,
        fromEmail: initialAdminEmail,
        replyTo: initialAdminEmail,
      },
    });

    // Auto-provision Default Site Content for homepage
    await prisma.siteContent.create({
      data: {
        tenantId: tenant.id,
        page: 'home',
        content: {
          heroHeading: `Welcome to ${name}`,
          heroSubheading: 'Empowering minds, fostering leadership, and building academic excellence.',
        },
      },
    });

    return NextResponse.json({ success: true, tenant });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create tenant' }, { status: 500 });
  }
}
