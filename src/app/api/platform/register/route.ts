import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/auth/passwords';
import { isReservedSlug, isValidSlugFormat } from '@/lib/tenant';
import { createTenantSession, TENANT_COOKIE_NAME } from '@/lib/auth/tenant-auth';
import { createSessionHandoffTicket } from '@/lib/auth/session-handoff';
import { getTenantUrl } from '@/lib/tenant-url';
import { sendPlatformWelcomeEmail } from '@/lib/email-service';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';
import { recordAuditLog } from '@/lib/audit';
import { getDefaultTrialDays } from '@/lib/platform-settings';

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req);
    const regRateCheck = await checkRateLimit(`reg_ip_${clientIp}`, { limit: 5, windowSeconds: 3600 });
    if (!regRateCheck.success) {
      return NextResponse.json(
        { error: 'Too many registration requests from this network. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(regRateCheck.resetSeconds) } }
      );
    }

    let body = await req.json();
    let cachedPasswordHash: string | null = null;

    // Paid activation is hydrated only from the server-side pending record.
    // Never merge browser-supplied registration data over the saved details.
    const ref = body.reference || body.ref || body.trxref;
    if (ref) {
      const { getPendingRegistration } = await import('@/lib/pending-registrations');
      const cached = await getPendingRegistration(ref);
      if (!cached) return NextResponse.json({ error: 'Registration payment session expired. Please restart registration.' }, { status: 410 });
      cachedPasswordHash = cached.passwordHash;
      const { passwordHash: _passwordHash, ...safeCached } = cached;
      body = { ...safeCached, reference: String(ref), registrationMode: 'paid' };
    }

    const {
      schoolName,
      slug,
      adminName,
      adminEmail,
      password,
      planId = 'plan_growth',
      lowestLevelName = 'Nursery 1',
      highestLevelName = 'SSS 3',
      primaryColor = '#1E3A8A',
      accentColor = '#2563EB',
      logoUrl = null,
      heroImageUrl = null,
      motto = '',
      heroSubheading = '',
      galleryImages = [],
      templateId = 'heritage',
      sliderSlides = [],
      registrationMode = 'trial',
    } = body;

    if (registrationMode !== 'trial' && registrationMode !== 'paid') {
      return NextResponse.json({ error: 'Choose either a trial account or paid activation' }, { status: 400 });
    }

    const cleanSlug = (slug || '').trim().toLowerCase();
    const cleanEmail = (adminEmail || '').trim().toLowerCase();
    const cleanSchoolName = (schoolName || '').trim();
    const cleanAdminName = (adminName || '').trim();

    if (!cleanSchoolName || !cleanSlug || !cleanEmail || (!password && !cachedPasswordHash) || !cleanAdminName) {
      return NextResponse.json(
        { error: 'School name, subdomain slug, admin name, email, and password are required' },
        { status: 400 }
      );
    }

    if (isReservedSlug(cleanSlug)) {
      return NextResponse.json(
        { error: `The subdomain slug "${cleanSlug}" is reserved by the system.` },
        { status: 400 }
      );
    }

    if (!isValidSlugFormat(cleanSlug)) {
      return NextResponse.json(
        { error: 'Slug must be 3-63 lowercase alphanumeric characters and hyphens.' },
        { status: 400 }
      );
    }

    // Check slug uniqueness
    const existingTenant = await prisma.tenant.findUnique({
      where: { slug: cleanSlug },
    });
    if (existingTenant) {
      return NextResponse.json(
        { error: `Subdomain slug "${cleanSlug}" is already registered by another school.` },
        { status: 409 }
      );
    }

    // Verify Plan existence
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      return NextResponse.json({ error: 'Selected plan tier is invalid' }, { status: 400 });
    }

    if (registrationMode === 'paid' && !process.env.PAYSTACK_SECRET_KEY) {
      return NextResponse.json({ error: 'Paid activation is unavailable until the payment gateway is configured' }, { status: 503 });
    }

    if (registrationMode === 'paid') {
      if (!ref) {
        return NextResponse.json({ error: 'A verified payment reference is required to activate a paid account' }, { status: 402 });
      }
      const verification = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(ref)}`, {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
        cache: 'no-store',
      });
      const verificationData = await verification.json().catch(() => null);
      const transaction = verificationData?.data;
      const expectedKobo = Math.round(Number(plan.price) * 100);
      if (!verification.ok || !verificationData.status || transaction?.status !== 'success' ||
          transaction?.reference !== ref || transaction?.currency !== 'NGN' ||
          transaction?.metadata?.type !== 'registration' || transaction?.metadata?.planId !== plan.id ||
          transaction?.metadata?.slug !== cleanSlug ||
          String(transaction?.customer?.email || '').toLowerCase() !== cleanEmail ||
          Number(transaction?.amount) !== expectedKobo) {
        return NextResponse.json({ error: 'Payment could not be verified for the selected plan and price' }, { status: 402 });
      }
    }

    // Resolve class levels
    const [lowestClass, highestClass] = await Promise.all([
      prisma.classLevel.findFirst({ where: { name: lowestLevelName } }),
      prisma.classLevel.findFirst({ where: { name: highestLevelName } }),
    ]);

    // Hash admin password
    const passwordHash = cachedPasswordHash || await hashPassword(password);

    // A trial is time limited; paid registrations start active with no trial expiry.
    const trialEndsAt = registrationMode === 'trial'
      ? new Date(Date.now() + (await getDefaultTrialDays()) * 24 * 60 * 60 * 1000)
      : null;
    const now = new Date();
    const annualContractExpiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    const { tenant, user } = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        slug: cleanSlug,
        name: cleanSchoolName,
        planId: plan.id,
        annualContractPrice: plan.price,
        subscriptionStartedAt: now,
        subscriptionExpiresAt: annualContractExpiresAt,
        status: registrationMode === 'trial' ? 'trial' : 'active',
        trialEndsAt,
        lowestClassLevelId: lowestClass?.id || null,
        highestClassLevelId: highestClass?.id || null,
        branding: {
          primaryColor: primaryColor || '#1E3A8A',
          accentColor: accentColor || '#2563EB',
          logoUrl: logoUrl || null,
          templateId: templateId || 'heritage',
          fontHeading: templateId === 'heritage' ? 'Merriweather' : 'Inter',
          fontBody: 'Inter',
        },
      },
    });

    // 2. Create DomainAlias for local subdomain testing
    await tx.domainAlias.create({
      data: {
        tenantId: tenant.id,
        domain: `${cleanSlug}.localhost:3000`,
        verifiedAt: new Date(),
        verificationToken: `token_${cleanSlug}_auto`,
      },
    });

    // 3. Create Initial Academic Session (2024/2025) & Terms
    const session = await tx.academicSession.create({
      data: {
        tenantId: tenant.id,
        label: '2024/2025',
        startDate: new Date('2024-09-02'),
        endDate: new Date('2025-07-18'),
        isCurrent: true,
      },
    });

    const term1 = await tx.term.create({
      data: {
        sessionId: session.id,
        name: '1st Term',
        startDate: new Date('2024-09-02'),
        endDate: new Date('2024-12-13'),
        isCurrent: true,
      },
    });

    await tx.term.createMany({
      data: [
        { sessionId: session.id, name: '2nd Term', startDate: new Date('2025-01-06'), endDate: new Date('2025-04-11'), isCurrent: false },
        { sessionId: session.id, name: '3rd Term', startDate: new Date('2025-04-28'), endDate: new Date('2025-07-18'), isCurrent: false },
      ],
    });

    // 4. Create Default Assessment Components (1st CA 20%, 2nd CA 20%, Exam 60%)
    await tx.assessmentComponent.createMany({
      data: [
        { tenantId: tenant.id, termId: null, name: '1st CA', maxScore: 20, weightPercent: 20.0, orderIndex: 1 },
        { tenantId: tenant.id, termId: null, name: '2nd CA', maxScore: 20, weightPercent: 20.0, orderIndex: 2 },
        { tenantId: tenant.id, termId: null, name: 'Exam', maxScore: 60, weightPercent: 60.0, orderIndex: 3 },
      ],
    });

    // 5. Create Default Grading Scale
    if (lowestClass && highestClass) {
      await tx.gradingScale.createMany({
        data: [
          { tenantId: tenant.id, lowestClassLevelId: lowestClass.id, highestClassLevelId: highestClass.id, minScore: 70, maxScore: 100, grade: 'A', remark: 'Excellent' },
          { tenantId: tenant.id, lowestClassLevelId: lowestClass.id, highestClassLevelId: highestClass.id, minScore: 60, maxScore: 69, grade: 'B', remark: 'Very Good' },
          { tenantId: tenant.id, lowestClassLevelId: lowestClass.id, highestClassLevelId: highestClass.id, minScore: 50, maxScore: 59, grade: 'C', remark: 'Good' },
          { tenantId: tenant.id, lowestClassLevelId: lowestClass.id, highestClassLevelId: highestClass.id, minScore: 45, maxScore: 49, grade: 'D', remark: 'Fair' },
          { tenantId: tenant.id, lowestClassLevelId: lowestClass.id, highestClassLevelId: highestClass.id, minScore: 40, maxScore: 44, grade: 'E', remark: 'Poor' },
          { tenantId: tenant.id, lowestClassLevelId: lowestClass.id, highestClassLevelId: highestClass.id, minScore: 0, maxScore: 39, grade: 'F', remark: 'Fail' },
        ],
      });
    }

    // 6. Create Admin Staff & TenantUser Account
    const staff = await tx.staff.create({
      data: {
        tenantId: tenant.id,
        name: cleanAdminName,
        roleBase: 'admin',
        contactInfo: { email: cleanEmail },
      },
    });

    const user = await tx.tenantUser.create({
      data: {
        tenantId: tenant.id,
        username: cleanEmail,
        passwordHash,
        role: 'school_admin',
        staffId: staff.id,
        isActive: true,
      },
    });

    // 7. Create Site Content & Motto for public homepage
    const primaryHeroImage = heroImageUrl || (Array.isArray(galleryImages) && galleryImages[0]?.url) || null;
    const defaultSlides = [
      {
        title: motto ? `${cleanSchoolName}` : `Welcome to ${cleanSchoolName}`,
        subtitle: heroSubheading || 'A welcoming place to learn, grow and prepare for the next step.',
        imageUrl: primaryHeroImage,
        ctaText: 'Enroll Now',
        ctaLink: '/admissions',
      },
      {
        title: 'Learning that builds confidence',
        subtitle: 'Students develop strong foundations through lessons, practice and support from their teachers.',
        imageUrl: (Array.isArray(galleryImages) && galleryImages[1]?.url) || primaryHeroImage,
        ctaText: 'Explore Academics',
        ctaLink: '/academics',
      },
      {
        title: 'A school community for every family',
        subtitle: 'Get to know the people, learning spaces and activities that make up everyday school life.',
        imageUrl: (Array.isArray(galleryImages) && galleryImages[2]?.url) || primaryHeroImage,
        ctaText: 'Campus Gallery',
        ctaLink: '/gallery',
      },
    ];

    await tx.siteContent.create({
      data: {
        tenantId: tenant.id,
        page: 'home',
        content: {
          heroTitle: motto ? `${cleanSchoolName} — ${motto}` : `Welcome to ${cleanSchoolName}`,
          heroSubtitle: heroSubheading || 'A welcoming place to learn, grow and prepare for the next step.',
          heroImageUrl: primaryHeroImage,
          motto: motto || 'Academic Excellence & Character Development',
          templateId: templateId || 'heritage',
          sliderSlides: Array.isArray(sliderSlides) && sliderSlides.length > 0 ? sliderSlides : defaultSlides,
        },
      },
    });

    // 8. Create Campus Gallery Images if provided during onboarding
    if (Array.isArray(galleryImages) && galleryImages.length > 0) {
      await tx.galleryImage.createMany({
        data: galleryImages.map((g: any, idx: number) => ({
          tenantId: tenant.id,
          imageUrl: g.url || g,
          caption: g.title || `Campus Facility ${idx + 1}`,
          album: g.album || 'Campus Life',
        })),
      });
    }

    return { tenant, user };
    }, { maxWait: 10_000, timeout: 30_000 });

    // 8. Create Session Cookie & Dispatch Welcome Email Notification
    const { token, expiresAt } = await createTenantSession(tenant.id, user.id);

    // Record immutable audit event for school registration
    await recordAuditLog({
      tenantId: tenant.id,
      actorId: user.id,
      actorName: cleanAdminName,
      actorRole: 'school_admin',
      action: 'TENANT_REGISTERED',
      entityType: 'tenant',
      entityId: tenant.id,
      details: {
        planId: plan.id,
        planName: plan.name,
        slug: tenant.slug,
        email: cleanEmail,
        status: registrationMode === 'trial' ? 'trial' : 'active',
        trialEndsAt: trialEndsAt?.toISOString() || null,
      },
      ipAddress: clientIp,
    });

    // Send Welcome Email Notification to School Admin with Platform Branding
    await sendPlatformWelcomeEmail({
      tenantName: tenant.name,
      slug: tenant.slug,
      adminName: cleanAdminName,
      adminEmail: cleanEmail,
    }).catch((err) => console.warn('Platform welcome email dispatch warning:', err));

    // Create session handoff ticket to install session cookies directly on target tenant subdomain
    const handoffTicket = createSessionHandoffTicket({
      token,
      tenantSlug: tenant.slug,
      nextPath: '/dashboard',
    });

    const redirectUrl = getTenantUrl(
      tenant.slug,
      `/api/tenant/auth/handoff?ticket=${handoffTicket}&next=/dashboard`
    );

    const res = NextResponse.json({
      success: true,
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
      redirectUrl,
    });

    res.cookies.set(TENANT_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    });

    // Clear any leftover impersonation cookie on self-service registration
    res.cookies.set('bms_impersonate_session', '', {
      httpOnly: false,
      expires: new Date(0),
      path: '/',
    });

    if (ref) {
      const { deletePendingRegistration } = await import('@/lib/pending-registrations');
      await deletePendingRegistration(ref);
    }

    return res;
  } catch (err: any) {
    console.error('Self-service tenant registration error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to complete tenant registration' },
      { status: 500 }
    );
  }
}
