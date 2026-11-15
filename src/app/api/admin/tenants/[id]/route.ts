import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSuperAdminFromCookies } from '@/lib/auth/super-admin-auth';
import { hashPassword } from '@/lib/auth/passwords';
import { recordAuditLog } from '@/lib/audit';
import { getClientIp } from '@/lib/rate-limiter';
import { dispatchEmail } from '@/lib/email-service';
import { getTenantUrl } from '@/lib/tenant-url';

/**
 * GET /api/admin/tenants/[id]
 * Fetch a school tenant and its primary administrator account details.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getSuperAdminFromCookies();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        users: {
          where: { role: 'school_admin' },
          include: {
            staff: { select: { id: true, name: true, contactInfo: true } },
          },
          take: 1,
        },
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'School tenant not found' }, { status: 404 });
    }

    const adminUser = tenant.users[0] || null;

    return NextResponse.json({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        adminUser: adminUser
          ? {
              id: adminUser.id,
              username: adminUser.username,
              isActive: adminUser.isActive,
              staffName: adminUser.staff?.name || null,
              contactInfo: adminUser.staff?.contactInfo || null,
            }
          : null,
      },
    });
  } catch (error: any) {
    console.error('Error fetching tenant details:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch tenant' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/tenants/[id]
 * Update a school tenant's administrator account credentials (username, email, password, name).
 * Audited, terminates stale sessions, and optionally emails the administrator.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getSuperAdminFromCookies();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const { username, password, staffName, terminateSessions = true, sendNotice = false } = body;

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        users: {
          where: { role: 'school_admin' },
          include: { staff: true },
          take: 1,
        },
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'School tenant not found' }, { status: 404 });
    }

    const adminUser = tenant.users[0];
    if (!adminUser) {
      return NextResponse.json({ error: 'No administrator user found for this school tenant' }, { status: 404 });
    }

    const cleanUsername = username ? String(username).trim().toLowerCase() : '';
    const cleanPassword = password ? String(password).trim() : '';
    const cleanStaffName = staffName ? String(staffName).trim() : '';

    if (cleanUsername && cleanUsername !== adminUser.username.toLowerCase()) {
      // Check collision within tenant
      const existing = await prisma.tenantUser.findFirst({
        where: {
          tenantId: tenant.id,
          username: cleanUsername,
          id: { not: adminUser.id },
        },
      });
      if (existing) {
        return NextResponse.json(
          { error: `The username "${cleanUsername}" is already in use by another account in this school.` },
          { status: 400 }
        );
      }
    }

    if (cleanPassword && cleanPassword.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters long.' }, { status: 400 });
    }

    const oldUsername = adminUser.username;
    let newPasswordHash: string | undefined;
    if (cleanPassword) {
      newPasswordHash = await hashPassword(cleanPassword);
    }

    // Execute atomic update
    await prisma.$transaction(async (tx) => {
      await tx.tenantUser.update({
        where: { id: adminUser.id },
        data: {
          ...(cleanUsername && { username: cleanUsername }),
          ...(newPasswordHash && { passwordHash: newPasswordHash }),
        },
      });

      if (adminUser.staffId && (cleanStaffName || cleanUsername)) {
        const staffContact = (adminUser.staff?.contactInfo as Record<string, any>) || {};
        await tx.staff.update({
          where: { id: adminUser.staffId },
          data: {
            ...(cleanStaffName && { name: cleanStaffName }),
            contactInfo: {
              ...staffContact,
              ...(cleanUsername && { email: cleanUsername }),
            },
          },
        });
      }

      if (terminateSessions) {
        await tx.tenantSession.deleteMany({
          where: { userId: adminUser.id },
        });
      }
    });

    // Record audit log
    recordAuditLog({
      tenantId: tenant.id,
      actorId: auth.superAdmin.id,
      actorName: auth.superAdmin.email || 'Super Admin',
      actorRole: 'super_admin',
      action: 'SUPER_ADMIN_UPDATED_TENANT_ADMIN',
      entityType: 'tenant_user',
      entityId: adminUser.id,
      details: {
        tenantSlug: tenant.slug,
        previousUsername: oldUsername,
        newUsername: cleanUsername || oldUsername,
        nameUpdated: Boolean(cleanStaffName),
        passwordChanged: Boolean(cleanPassword),
        sessionsTerminated: Boolean(terminateSessions),
      },
      ipAddress: getClientIp(req),
    }).catch((err) => console.warn('[SuperAdmin audit warning]', err));

    // Send notifications if requested and valid email
    if (sendNotice && (cleanUsername || oldUsername)) {
      const recipientEmail = cleanUsername || oldUsername;
      const schoolPortalUrl = getTenantUrl(tenant.slug);
      
      const emailContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b;">
          <h2 style="color: #0f172a; margin-bottom: 8px;">Your School Portal Credentials Have Been Updated</h2>
          <p style="font-size: 14px; color: #475569;">
            The administrator credentials for <strong>${tenant.name}</strong> were updated by platform support.
          </p>
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 20px 0;">
            <p style="margin: 4px 0; font-size: 13px;"><strong>Portal Address:</strong> <a href="${schoolPortalUrl}" style="color: #2563eb;">${schoolPortalUrl}</a></p>
            <p style="margin: 4px 0; font-size: 13px;"><strong>Username / Email:</strong> ${cleanUsername || oldUsername}</p>
            ${cleanPassword ? `<p style="margin: 4px 0; font-size: 13px;"><strong>New Temporary Password:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${cleanPassword}</code></p>` : ''}
          </div>
          <p style="font-size: 12px; color: #64748b;">
            Please log in and update your password immediately if a temporary password was provided. If you did not request this update, contact support immediately.
          </p>
        </div>
      `;

      dispatchEmail({
        to: recipientEmail,
        subject: `[${tenant.name}] Administrator Account Update`,
        html: emailContent,
        tenantId: tenant.id,
      }).catch((err) => console.warn('[Admin notice email error]', err));

      // Also alert old email if changed
      if (cleanUsername && oldUsername && cleanUsername !== oldUsername && oldUsername.includes('@')) {
        dispatchEmail({
          to: oldUsername,
          subject: `Security Alert: Admin Email Changed for ${tenant.name}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
              <h3 style="color: #b91c1c;">Security Notice</h3>
              <p style="font-size: 14px; color: #334155;">
                The primary administrator email for <strong>${tenant.name}</strong> has been changed from this address to <strong>${cleanUsername}</strong>.
              </p>
              <p style="font-size: 12px; color: #64748b;">
                If you did not authorize this change, please contact platform security immediately.
              </p>
            </div>
          `,
          tenantId: tenant.id,
        }).catch((err) => console.warn('[Old email security alert error]', err));
      }
    }

    return NextResponse.json({
      success: true,
      message: `Administrator credentials for "${tenant.name}" updated successfully.`,
      updatedUsername: cleanUsername || oldUsername,
    });
  } catch (error: any) {
    console.error('Error updating tenant admin:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update tenant admin.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/tenants/[id]
 * Permanently purge a school tenant and all associated database records (§11.1).
 * Requires SuperAdmin authentication + slug confirmation payload.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getSuperAdminFromCookies();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { confirmSlug } = body;

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'School tenant not found' }, { status: 404 });
    }

    if (confirmSlug !== tenant.slug) {
      return NextResponse.json(
        { error: `Confirmation mismatch. You must provide exact slug "${tenant.slug}" to permanently delete.` },
        { status: 400 }
      );
    }

    // Permanent hard delete — database foreign keys will cascade purge all tenant records
    await prisma.tenant.delete({
      where: { id: tenant.id },
    });

    return NextResponse.json({
      success: true,
      message: `Tenant "${tenant.name}" (${tenant.slug}) and all associated records were permanently purged.`,
    });
  } catch (error: any) {
    console.error('Error hard-deleting tenant:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to permanently delete tenant.' },
      { status: 500 }
    );
  }
}
