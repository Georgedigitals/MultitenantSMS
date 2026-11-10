import { NextRequest, NextResponse } from 'next/server';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import prisma from '@/lib/prisma';
import { verifySmtpConnection } from '@/lib/email-service';

/**
 * GET /api/tenant/settings/email
 * Retrieves tenant custom email/SMTP configuration with masked password.
 */
export async function GET() {
  try {
    const auth = await getTenantUserFromCookies();
    if (!auth || auth.user.role !== 'school_admin') {
      return NextResponse.json({ error: 'Unauthorized — Admin role required' }, { status: 403 });
    }

    const config = await prisma.emailConfiguration.findUnique({
      where: { tenantId: auth.tenant.id },
    });

    if (!config) {
      return NextResponse.json({
        hasCustomSmtp: false,
        config: null,
      });
    }

    return NextResponse.json({
      hasCustomSmtp: true,
      config: {
        host: config.host,
        port: config.port,
        secure: config.secure,
        user: config.user,
        pass: '••••••••',
        fromName: config.fromName,
        fromEmail: config.fromEmail,
        replyTo: config.replyTo,
        verified: config.verified,
        updatedAt: config.updatedAt,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

/**
 * POST /api/tenant/settings/email
 * Validates, verifies, and saves custom SMTP configuration for the tenant.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getTenantUserFromCookies();
    if (!auth || auth.user.role !== 'school_admin') {
      return NextResponse.json({ error: 'Unauthorized — Admin role required' }, { status: 403 });
    }

    const body = await req.json();
    const { host, port, secure, user, pass, fromName, fromEmail, replyTo } = body;

    if (!host || !user || !pass) {
      return NextResponse.json(
        { error: 'host, user, and pass are required fields' },
        { status: 400 }
      );
    }

    const parsedPort = Number(port) || (secure ? 465 : 587);
    const isSecure = typeof secure === 'boolean' ? secure : parsedPort === 465;

    // Verify SMTP connectivity before persisting to database
    const verification = await verifySmtpConnection({
      host: host.trim(),
      port: parsedPort,
      secure: isSecure,
      user: user.trim(),
      pass: pass.trim(),
    });

    if (!verification.success) {
      return NextResponse.json(
        { error: `SMTP Authentication failed: ${verification.error}` },
        { status: 422 }
      );
    }

    const saved = await prisma.emailConfiguration.upsert({
      where: { tenantId: auth.tenant.id },
      create: {
        tenantId: auth.tenant.id,
        host: host.trim(),
        port: parsedPort,
        secure: isSecure,
        user: user.trim(),
        pass: pass.trim(),
        fromName: fromName?.trim() || (auth.tenant as any).name || 'School Portal',
        fromEmail: fromEmail?.trim() || user.trim(),
        replyTo: replyTo?.trim() || fromEmail?.trim() || user.trim(),
        verified: true,
      },
      update: {
        host: host.trim(),
        port: parsedPort,
        secure: isSecure,
        user: user.trim(),
        pass: pass.trim(),
        fromName: fromName?.trim() || (auth.tenant as any).name || 'School Portal',
        fromEmail: fromEmail?.trim() || user.trim(),
        replyTo: replyTo?.trim() || fromEmail?.trim() || user.trim(),
        verified: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Custom SMTP settings verified and saved successfully',
      config: {
        host: saved.host,
        port: saved.port,
        secure: saved.secure,
        user: saved.user,
        fromName: saved.fromName,
        fromEmail: saved.fromEmail,
        replyTo: saved.replyTo,
        verified: saved.verified,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/tenant/settings/email
 * Deletes tenant custom SMTP settings, reverting school back to platform default.
 */
export async function DELETE() {
  try {
    const auth = await getTenantUserFromCookies();
    if (!auth || auth.user.role !== 'school_admin') {
      return NextResponse.json({ error: 'Unauthorized — Admin role required' }, { status: 403 });
    }

    await prisma.emailConfiguration.deleteMany({
      where: { tenantId: auth.tenant.id },
    });

    return NextResponse.json({
      success: true,
      message: 'Custom SMTP configuration removed. School now uses platform default SMTP.',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
