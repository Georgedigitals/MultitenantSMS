import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/auth/passwords';
import { decodeResetTokenPayload, verifyPasswordResetToken } from '@/lib/auth/password-reset-token';
import { findTenantBySlugOrDomain } from '@/lib/tenant';

/**
 * POST /api/tenant/auth/reset-password
 * Verifies the single-use cryptographic reset token and updates the user's password.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, token, newPassword, confirmPassword } = body;

    if (!slug || !token || !newPassword) {
      return NextResponse.json({ error: 'slug, token, and newPassword are required' }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters long' }, { status: 400 });
    }

    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 });
    }

    const tenant = await findTenantBySlugOrDomain(slug, { id: true, name: true, slug: true });

    if (!tenant) {
      return NextResponse.json({ error: 'School instance not found' }, { status: 404 });
    }

    // 1. Decode token to extract userId
    const payload = decodeResetTokenPayload(token);
    if (!payload || !payload.userId || payload.tenantId !== tenant.id) {
      return NextResponse.json({ error: 'Invalid or malformed reset token' }, { status: 400 });
    }

    // 2. Fetch user to verify HMAC signature against their current password hash
    const user = await prisma.tenantUser.findFirst({
      where: {
        id: payload.userId,
        tenantId: tenant.id,
        isActive: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User account not found or has been deactivated' }, { status: 404 });
    }

    // 3. Cryptographic verification (checks expiry + HMAC signature using current passwordHash)
    const verification = verifyPasswordResetToken(token, user);
    if (!verification.valid) {
      return NextResponse.json(
        { error: verification.reason || 'This password reset link is invalid or has already been used.' },
        { status: 400 }
      );
    }

    // 4. Hash new password and update in atomic transaction
    const newPasswordHash = await hashPassword(newPassword);

    await prisma.$transaction(async (tx) => {
      await tx.tenantUser.update({
        where: { id: user.id },
        data: {
          passwordHash: newPasswordHash,
          updatedAt: new Date(),
        },
      });
      // Invalidate existing sessions for security
      await tx.tenantSession.deleteMany({
        where: { userId: user.id },
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Your password has been successfully reset. You may now sign in with your new password.',
    });
  } catch (error: any) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to reset password' },
      { status: 500 }
    );
  }
}

