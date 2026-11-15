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

    const isCustomActive = Boolean(config.verified && config.host && config.user);

    return NextResponse.json({
      hasCustomSmtp: isCustomActive,
      config: {
        host: config.host,
        port: config.port,
        secure: config.secure,
        user: config.user,
        pass: config.pass ? '••••••••' : '',
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
 * Validates, verifies, and saves custom SMTP configuration or Sender/Reply-To preferences.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { slug, host, port, secure, user, pass, fromName, fromEmail, replyTo, isPreferencesOnly } = body;

    let expectedTenantId: string | undefined;
    if (typeof slug === 'string' && slug.trim()) {
      const targetTenant = await prisma.tenant.findUnique({
        where: { slug: slug.trim().toLowerCase() },
        select: { id: true },
      });
      expectedTenantId = targetTenant?.id;
    }

    const auth = await getTenantUserFromCookies(expectedTenantId);
    if (!auth || auth.user.role !== 'school_admin') {
      return NextResponse.json({ error: 'Unauthorized — Admin role required' }, { status: 403 });
    }

    const existing = await prisma.emailConfiguration.findUnique({
      where: { tenantId: auth.tenant.id },
    });

    const cleanFromName = fromName?.trim() || (auth.tenant as any).name || 'School Portal';
    const cleanReplyTo = replyTo?.trim() || '';
    const cleanFromEmail = fromEmail?.trim() || '';

    // Case 1: Updating only Sender Name and/or Direct Reply-To address (Platform Delivery Mode)
    const isSmtpConfiguring = Boolean(host?.trim() && user?.trim());
    if (!isSmtpConfiguring || isPreferencesOnly) {
      if (!cleanReplyTo) {
        return NextResponse.json({ error: 'Direct Reply-To address is required' }, { status: 400 });
      }

      const saved = await prisma.emailConfiguration.upsert({
        where: { tenantId: auth.tenant.id },
        create: {
          tenantId: auth.tenant.id,
          host: '',
          port: 465,
          secure: true,
          user: '',
          pass: '',
          fromName: cleanFromName,
          fromEmail: cleanFromEmail || cleanReplyTo,
          replyTo: cleanReplyTo,
          verified: false,
        },
        update: {
          fromName: cleanFromName,
          fromEmail: cleanFromEmail || cleanReplyTo,
          replyTo: cleanReplyTo,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Sender preferences and Direct Reply-To address saved successfully.',
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
    }

    // Case 2: Configuring Custom Private SMTP (e.g. Gmail App Password, Outlook, cPanel)
    const rawPass = typeof pass === 'string' ? pass.trim() : '';
    // If password input is empty or masked placeholder, reuse existing stored password
    const cleanPass = (!rawPass || rawPass === '••••••••') && existing?.pass
      ? existing.pass
      : rawPass.replace(/\s+/g, '');

    if (!cleanPass) {
      return NextResponse.json(
        { error: 'SMTP Password is required to activate custom private server' },
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
      pass: cleanPass,
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
        pass: cleanPass,
        fromName: cleanFromName,
        fromEmail: cleanFromEmail || user.trim(),
        replyTo: cleanReplyTo || cleanFromEmail || user.trim(),
        verified: true,
      },
      update: {
        host: host.trim(),
        port: parsedPort,
        secure: isSecure,
        user: user.trim(),
        pass: cleanPass,
        fromName: cleanFromName,
        fromEmail: cleanFromEmail || user.trim(),
        replyTo: cleanReplyTo || cleanFromEmail || user.trim(),
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
 * Deactivates tenant custom SMTP settings, reverting school back to platform default
 * while retaining sender name and direct reply-to preferences.
 */
export async function DELETE(req: NextRequest) {
  try {
    const slug = req.nextUrl.searchParams.get('slug');
    let expectedTenantId: string | undefined;
    if (slug && slug.trim()) {
      const targetTenant = await prisma.tenant.findUnique({
        where: { slug: slug.trim().toLowerCase() },
        select: { id: true },
      });
      expectedTenantId = targetTenant?.id;
    }

    const auth = await getTenantUserFromCookies(expectedTenantId);
    if (!auth || auth.user.role !== 'school_admin') {
      return NextResponse.json({ error: 'Unauthorized — Admin role required' }, { status: 403 });
    }

    const existing = await prisma.emailConfiguration.findUnique({
      where: { tenantId: auth.tenant.id },
    });

    if (existing) {
      await prisma.emailConfiguration.update({
        where: { tenantId: auth.tenant.id },
        data: {
          host: '',
          user: '',
          pass: '',
          verified: false,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Custom SMTP configuration removed. School now uses platform default SMTP with your direct reply-to address.',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
