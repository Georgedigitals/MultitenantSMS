import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { generatePasswordResetToken } from '@/lib/auth/password-reset-token';
import { sendTenantBrandedPasswordResetEmail, sendTenantBrandedNotification } from '@/lib/email-service';
import { findTenantBySlugOrDomain } from '@/lib/tenant';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';

/**
 * POST /api/tenant/auth/forgot-password
 * Triggers password reset email for tenant users (staff, students, parents).
 * Dispatches HTML email dynamically branded with THE TENANT'S OWN LOGO, COLORS, AND NAME!
 */
export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req);
    const body = await req.json();
    const { slug, usernameOrEmail } = body;

    if (!slug || !usernameOrEmail?.trim()) {
      return NextResponse.json({ error: 'slug and usernameOrEmail are required' }, { status: 400 });
    }

    const tenant = await findTenantBySlugOrDomain(slug, { id: true, name: true, slug: true });

    if (!tenant) {
      return NextResponse.json({ error: 'School instance not found' }, { status: 404 });
    }

    const rateLimit = await checkRateLimit(`forgot_pwd_${tenant.id}_${clientIp}`, {
      limit: 5,
      windowSeconds: 600,
    });
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: `Too many password reset requests. Please try again in ${rateLimit.resetSeconds} seconds.` },
        { status: 429 }
      );
    }

    const cleanInput = usernameOrEmail.trim().toLowerCase();

    // Find TenantUser by username or linked staff/student/guardian email
    let user = await prisma.tenantUser.findFirst({
      where: {
        tenantId: tenant.id,
        username: cleanInput,
        isActive: true,
      },
      include: {
        staff: true,
        student: true,
        guardian: true,
      },
    });

    if (!user) {
      // Check if input is a staff contact email
      const staffMember = await prisma.staff.findFirst({
        where: {
          tenantId: tenant.id,
          contactInfo: { path: ['email'], equals: cleanInput },
        },
        include: { userAccount: true },
      });
      if (staffMember?.userAccount?.isActive) {
        user = {
          ...staffMember.userAccount,
          staff: staffMember,
          student: null,
          guardian: null,
        } as any;
      }
    }

    if (!user) {
      // Check if input is a student personal email or contact email
      const studentMember = await prisma.student.findFirst({
        where: {
          tenantId: tenant.id,
          OR: [
            { guardianContactInfo: { path: ['studentEmail'], equals: cleanInput } },
            { guardianContactInfo: { path: ['email'], equals: cleanInput } },
            { guardianContactInfo: { path: ['guardianEmail'], equals: cleanInput } },
          ],
        },
        include: { userAccount: true },
      });
      if (studentMember?.userAccount?.isActive) {
        user = {
          ...studentMember.userAccount,
          student: studentMember,
          staff: null,
          guardian: null,
        } as any;
      }
    }

    if (!user) {
      // Check if input is a guardian/parent email
      const guardianMember = await prisma.guardian.findFirst({
        where: {
          tenantId: tenant.id,
          contactInfo: { path: ['email'], equals: cleanInput },
        },
        include: { userAccount: true },
      });
      if (guardianMember?.userAccount?.isActive) {
        user = {
          ...guardianMember.userAccount,
          guardian: guardianMember,
          staff: null,
          student: null,
        } as any;
      }
    }

    // To prevent account enumeration in production, return generic success even if user not found
    if (!user) {
      return NextResponse.json({
        success: true,
        message: 'If an account exists for this username or email, a password reset link has been dispatched.',
      });
    }

    const resetToken = generatePasswordResetToken(user);
    const recipientName = user.staff?.name || user.student?.name || (user.guardian as any)?.name || user.username;

    let recipientEmail = user.username;
    let guardianCourtesyEmail: string | null = null;

    if (user.role === 'student' && user.student) {
      const gci = (user.student.guardianContactInfo as Record<string, any>) || {};
      const studentOwnEmail = typeof gci.studentEmail === 'string' && gci.studentEmail.trim() ? gci.studentEmail.trim() : null;
      const guardianEmail = typeof gci.guardianEmail === 'string' && gci.guardianEmail.trim()
        ? gci.guardianEmail.trim()
        : (typeof gci.email === 'string' && gci.email.trim() ? gci.email.trim() : null);

      if (studentOwnEmail) {
        // Priority 1: Senior student's own verified email
        recipientEmail = studentOwnEmail;
        if (guardianEmail && guardianEmail.toLowerCase() !== studentOwnEmail.toLowerCase()) {
          guardianCourtesyEmail = guardianEmail;
        }
      } else if (guardianEmail) {
        // Priority 2: Primary/Junior student fallback to parent/guardian email
        recipientEmail = guardianEmail;
      }
    } else if (user.role === 'parent' && (user as any).guardian) {
      const ci = ((user as any).guardian.contactInfo as Record<string, any>) || {};
      recipientEmail = ci.email || user.username;
    } else if (user.staff) {
      const ci = (user.staff.contactInfo as Record<string, any>) || {};
      recipientEmail = ci.email || user.username;
    }

    const host = req.headers.get('host') || 'localhost:3000';
    const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
    const protocol = process.env.NODE_ENV === 'production' && !isLocal ? 'https' : 'http';
    const resetPath = host.startsWith(`${tenant.slug}.`) ? '/reset-password' : `/${tenant.slug}/reset-password`;
    const resetUrl = `${protocol}://${host}${resetPath}?token=${resetToken}&email=${encodeURIComponent(user.username)}`;

    // Dispatch Tenant-Branded Reset Email directly to student/parent
    await sendTenantBrandedPasswordResetEmail({
      tenantId: tenant.id,
      recipientEmail,
      recipientName,
      resetToken,
      customDomainHost: host,
    }).catch((err) => console.warn('Tenant-branded reset email warning:', err));

    // If senior student reset their password and parent email is known, send courtesy safeguarding alert
    if (guardianCourtesyEmail) {
      sendTenantBrandedNotification({
        tenantId: tenant.id,
        recipientEmail: guardianCourtesyEmail,
        recipientName: 'Parent / Guardian',
        subject: `Security Notice: Portal Password Reset Request for ${user.student?.name || 'Your Ward'}`,
        messageText: `Dear Parent/Guardian,\n\nA password reset request was initiated for your ward, ${user.student?.name || 'your ward'}, on the ${tenant.name} Student Portal. The secure reset link has been sent directly to their registered student email (${recipientEmail}).\n\nIf your ward requested this to sign in for studies or CBT online exams, no action is required from you. If you did not authorize this, please contact the school administration immediately.`,
      }).catch((err) => console.warn('[Guardian courtesy reset notice warning]', err));
    }

    return NextResponse.json({
      success: true,
      message: 'If an account exists for this username or email, a password reset link has been dispatched.',
      // In development mode, provide the direct reset URL for immediate testing
      devResetUrl: process.env.NODE_ENV !== 'production' ? resetUrl : undefined,
    });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process password reset' },
      { status: 500 }
    );
  }
}
