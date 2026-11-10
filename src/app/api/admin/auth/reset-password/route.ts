import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/auth/passwords';
import { checkRateLimit, resetRateLimit } from '@/lib/auth/rate-limit';
import { sendSuperAdminPasswordChangedAlert } from '@/lib/email-service';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    const body = await req.json().catch(() => ({}));
    const { token, password, confirmPassword } = body;

    // Rate Limiting: 5 attempts in prod, 25 in dev for testing
    const isProd = process.env.NODE_ENV === 'production';
    const rateLimitKey = `sa_reset_pw_submit_${ip}`;
    const rateLimit = checkRateLimit(rateLimitKey, isProd ? 5 : 25, isProd ? 900 : 60);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: `Too many password reset attempts. Please wait ${Math.ceil(rateLimit.resetSeconds / 60)} minutes before trying again.`,
        },
        { status: 429 }
      );
    }

    if (!token || typeof token !== 'string' || token.length !== 64) {
      return NextResponse.json(
        { error: 'Invalid or missing password reset token.' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'New password is required.' },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: 'Passwords do not match.' },
        { status: 400 }
      );
    }

    // Enterprise Super Admin Password Security Standard:
    // Minimum 12 characters with mixed case, numbers, and symbols, OR at least 16 characters.
    const hasComplexity =
      password.length >= 16 ||
      (password.length >= 12 &&
        /[A-Z]/.test(password) &&
        /[a-z]/.test(password) &&
        /[0-9]/.test(password) &&
        /[^A-Za-z0-9]/.test(password));

    if (!hasComplexity) {
      return NextResponse.json(
        {
          error:
            'Password must be at least 12 characters and contain uppercase, lowercase, numbers, and symbols (or be 16+ characters).',
        },
        { status: 400 }
      );
    }

    // Compute SHA-256 hash of incoming raw token
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Retrieve active reset token record
    const resetRecord = await prisma.superAdminPasswordResetToken.findUnique({
      where: { tokenHash },
      include: {
        superAdmin: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    if (!resetRecord) {
      return NextResponse.json(
        { error: 'This password reset link is invalid or has already been used.' },
        { status: 400 }
      );
    }

    // Verify token expiration
    if (new Date() > resetRecord.expiresAt) {
      // Clean up expired token
      await prisma.superAdminPasswordResetToken.delete({ where: { id: resetRecord.id } }).catch(() => {});
      return NextResponse.json(
        { error: 'This password reset link has expired. Please request a new one.' },
        { status: 410 }
      );
    }

    // Hash new password using bcrypt
    const newPasswordHash = await hashPassword(password);

    // 1. Update password hash
    await prisma.superAdmin.update({
      where: { id: resetRecord.superAdminId },
      data: { passwordHash: newPasswordHash },
    });
    // 2. Permanently delete used token (single-use enforcement)
    await prisma.superAdminPasswordResetToken.delete({
      where: { id: resetRecord.id },
    });
    // 3. Immediately revoke ALL active sessions for this admin (session eviction)
    await prisma.superAdminSession.deleteMany({
      where: { superAdminId: resetRecord.superAdminId },
    });

    // Reset rate limiter on success
    resetRateLimit(rateLimitKey);

    // Dispatch security confirmation alert email (fire-and-forget safely)
    sendSuperAdminPasswordChangedAlert({
      recipientEmail: resetRecord.superAdmin.email,
      adminName: resetRecord.superAdmin.name,
    }).catch((e) => console.error('[reset-password] Alert email error:', e));

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully! All previous sessions have been ended. You can now sign in.',
    });
  } catch (err: unknown) {
    console.error('[super-admin-reset-password] Internal error:', err);
    return NextResponse.json(
      { error: 'An unexpected server error occurred. Please try again shortly.' },
      { status: 500 }
    );
  }
}

