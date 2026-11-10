import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { sendSuperAdminPasswordResetEmail } from '@/lib/email-service';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'A valid email address is required.' },
        { status: 400 }
      );
    }

    // Rate Limiting: 3 requests per 15 mins in production; relaxed in local dev for testing
    const isProd = process.env.NODE_ENV === 'production';
    const rateLimitKey = `sa_forgot_pw_${ip}_${email}`;
    const rateLimit = checkRateLimit(rateLimitKey, isProd ? 3 : 25, isProd ? 900 : 60);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: `Too many password reset requests. Please wait ${Math.ceil(rateLimit.resetSeconds / 60)} minutes before trying again.`,
        },
        { status: 429 }
      );
    }

    // Look up Super Admin in database
    const superAdmin = await prisma.superAdmin.findUnique({
      where: { email },
      select: { id: true, email: true, name: true },
    });

    // Anti-Enumeration Defense:
    // If account doesn't exist, simulate subtle delay and return identical generic success response.
    if (!superAdmin) {
      if (!isProd) {
        console.warn(`\n⚠️  [SUPER ADMIN FORGOT PASSWORD]: No account with email "${email}" exists in the database. Ensure you ran "npm run db:seed:demo" or "npm run db:seed".\n`);
      }
      await new Promise((resolve) => setTimeout(resolve, 350));
      return NextResponse.json({
        success: true,
        message: 'If an account is associated with this email, a password reset link has been dispatched.',
      });
    }

    // Generate 32 bytes cryptographically secure random token (64 hex characters)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes validity

    // Wipe any prior unused reset tokens for this Super Admin + create new token
    await prisma.superAdminPasswordResetToken.deleteMany({
      where: { superAdminId: superAdmin.id },
    });
    await prisma.superAdminPasswordResetToken.create({
      data: {
        superAdminId: superAdmin.id,
        tokenHash,
        expiresAt,
      },
    });

    // Build reset link using absolute host origin
    const origin = req.headers.get('origin') || req.nextUrl.origin || 'http://localhost:3000';
    const resetUrl = `${origin}/admin/reset-password?token=${rawToken}`;

    if (!isProd) {
      console.log('\n============================================================');
      console.log('🔑 [SUPER ADMIN PASSWORD RESET LINK]');
      console.log(resetUrl);
      console.log('============================================================\n');
    }

    // Dispatch branded email notification asynchronously
    sendSuperAdminPasswordResetEmail({
      recipientEmail: superAdmin.email,
      adminName: superAdmin.name,
      resetUrl,
      expiresInMinutes: 15,
    })
      .then((res) => {
        console.log(`[forgot-password] Password reset email dispatched to ${superAdmin.email}. Simulated: ${res.simulated}`);
      })
      .catch((emailErr) => {
        console.error('[forgot-password] Email dispatch error:', emailErr?.message || emailErr);
      });

    return NextResponse.json({
      success: true,
      message: 'If an account is associated with this email, a password reset link has been dispatched.',
    });
  } catch (err: unknown) {
    console.error('[super-admin-forgot-password] Internal error:', err);
    return NextResponse.json(
      { error: 'An unexpected server error occurred. Please try again shortly.' },
      { status: 500 }
    );
  }
}

