/**
 * GET  /api/tenant/staff?slug=apex
 *   → list all staff members for the tenant
 * POST /api/tenant/staff
 *   → create a new staff member (school_admin only)
 *
 * All queries are tenant-isolated via getTenantDb (§11.1).
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTenantDb } from '@/lib/tenant-db';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { findTenantBySlugOrDomain } from '@/lib/tenant';
import { StaffRole, TenantUserRole } from '@prisma/client';
import { hashPassword } from '@/lib/auth/passwords';
import { sendWelcomeCredentialsEmail } from '@/lib/email-service';
import { randomBytes } from 'node:crypto';

async function resolveTenant(slug: string | null) {
  if (!slug) return null;
  return findTenantBySlugOrDomain(slug, { id: true, name: true, slug: true });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug');
  const sessionId = searchParams.get('sessionId'); // optional: include assignment counts

  const tenant = await resolveTenant(slug);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.user.role !== 'school_admin') {
    return NextResponse.json({ error: 'Forbidden: Only school administrators can view the staff directory' }, { status: 403 });
  }

  const db = getTenantDb(tenant.id);

  const staffList = await db.staff.findMany({
    include: {
      userAccount: {
        select: { id: true, username: true, role: true, isActive: true },
      },
      ...(sessionId
        ? {
            teachingAssignments: {
              where: { sessionId },
              include: { classLevel: true, subject: true },
            },
            formTeacherAssignments: {
              where: { sessionId },
              include: { classLevel: true },
            },
          }
        : {}),
    },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({ staff: staffList });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, name, roleBase, contactInfo } = body;

    if (!slug || !name || !roleBase) {
      return NextResponse.json({ error: 'slug, name, and roleBase are required' }, { status: 400 });
    }
    if (!['teacher', 'admin'].includes(roleBase)) {
      return NextResponse.json({ error: 'roleBase must be "teacher" or "admin"' }, { status: 400 });
    }
    const rawEmail = contactInfo?.email ? String(contactInfo.email).trim().toLowerCase() : '';
    const rawPhone = contactInfo?.phone ? String(contactInfo.phone).trim() : '';
    if (!rawEmail && !rawPhone) {
      return NextResponse.json({ error: 'Provide an email address or phone number to deliver login details securely' }, { status: 400 });
    }

    const tenant = await resolveTenant(slug);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const auth = await getTenantUserFromCookies(tenant.id);
    if (!auth || auth.user.role !== 'school_admin') {
      return NextResponse.json({ error: 'Only school admin can create staff members' }, { status: 403 });
    }

    const db = getTenantDb(tenant.id);
    const autoCode = `STF-${randomBytes(3).toString('hex').toUpperCase()}`;
    const autoPin = String(Math.floor(1000 + Math.random() * 9000));

    const staff = await db.staff.create({
      data: {
        name: name.trim(),
        roleBase: roleBase as StaffRole,
        contactInfo: contactInfo || null,
        staffCode: autoCode,
        attendancePin: autoPin,
      } as any,
    });

    // Determine unique username and password for TenantUser login
    const initialPassword = randomBytes(18).toString('base64url');
    const passwordHash = await hashPassword(initialPassword);

    let targetUsername = rawEmail || `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}@${tenant.slug}.edu`;

    // Ensure username is unique for this tenant
    let existingUser = await prisma.tenantUser.findUnique({
      where: { tenantId_username: { tenantId: tenant.id, username: targetUsername } },
    });
    if (existingUser) {
      return NextResponse.json({ error: 'This email is already used by another account in this school. Use a different login email.' }, { status: 409 });
    }

    const assignedRole = roleBase === 'admin' ? TenantUserRole.school_admin : TenantUserRole.teacher;

    const userAccount = await prisma.tenantUser.create({
      data: {
        tenantId: tenant.id,
        username: targetUsername,
        passwordHash,
        role: assignedRole,
        staffId: staff.id,
        isActive: true,
      },
      select: { id: true, username: true, role: true, isActive: true },
    });

    // Fire welcome email non-blocking if staff email is available
    const staffEmail = rawEmail;
    if (staffEmail) {
      sendWelcomeCredentialsEmail({
        tenantId: tenant.id,
        recipientEmail: staffEmail,
        recipientName: name.trim(),
        role: roleBase === 'admin' ? 'admin' : 'teacher',
        username: targetUsername,
        password: initialPassword,
        slug: tenant.slug,
      }).catch((err) => console.warn('[Staff welcome email error]', err));
    } else if (rawPhone) {
      import('@/lib/sms-service').then(({ sendSms }) => {
        sendSms({
          tenantId: tenant.id,
          phone: rawPhone,
          message: `Your ${tenant.name} staff portal is ready. Username: ${targetUsername}. Temporary password: ${initialPassword}. Sign in at /${tenant.slug}/login and change your password after signing in.`,
        }).catch((smsErr) => console.warn('[Staff welcome SMS error]', smsErr));
      }).catch(() => {});
    }

    return NextResponse.json(
      {
        staff: {
          ...staff,
          userAccount,
        },
        credentials: {
          username: targetUsername,
          emailSent: Boolean(staffEmail),
          smsSent: !staffEmail && Boolean(rawPhone),
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('Create staff error:', err);
    return NextResponse.json({ error: err.message || 'Failed to create staff member' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    const id = searchParams.get('id');

    if (!slug || !id) {
      return NextResponse.json({ error: 'slug and id parameters are required' }, { status: 400 });
    }

    const tenant = await resolveTenant(slug);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const auth = await getTenantUserFromCookies(tenant.id);
    if (!auth || auth.user.role !== 'school_admin') {
      return NextResponse.json({ error: 'Only school admin can delete staff records' }, { status: 403 });
    }

    const db = getTenantDb(tenant.id);

    const existing = await db.staff.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Staff record not found' }, { status: 404 });
    }

    // Safely clean up dependent relationships to prevent foreign key constraint crashes
    await prisma.$transaction(async (tx) => {
      // 1. Delete associated user login account
      await tx.tenantUser.deleteMany({
        where: { tenantId: tenant.id, staffId: id },
      });

      // 2. Delete assignments
      await tx.teachingAssignment.deleteMany({
        where: { staffId: id },
      });
      await tx.formTeacherAssignment.deleteMany({
        where: { staffId: id },
      });

      // 3. Nullify fee payment records recorded by this staff
      await tx.feePayment.updateMany({
        where: { recordedBy: id },
        data: { recordedBy: null },
      });

      // 4. Delete class reviews done by this form teacher
      await tx.classResultReview.deleteMany({
        where: { formTeacherId: id },
      });

      // 5. Safely handle attendance and results
      const fallbackStaff = await tx.staff.findFirst({
        where: { tenantId: tenant.id, id: { not: id } },
      });

      if (fallbackStaff) {
        await tx.attendanceRecord.updateMany({
          where: { markedBy: id },
          data: { markedBy: fallbackStaff.id },
        });
        await tx.resultEntry.updateMany({
          where: { teacherId: id },
          data: { teacherId: fallbackStaff.id },
        });
      } else {
        await tx.attendanceRecord.deleteMany({
          where: { markedBy: id },
        });
        await tx.resultEntry.deleteMany({
          where: { teacherId: id },
        });
      }

      // 6. Delete staff record
      await tx.staff.delete({ where: { id } });
    });

    return NextResponse.json({
      success: true,
      message: `Staff member "${existing.name}" permanently deleted.`,
    });
  } catch (err: any) {
    console.error('Delete staff error:', err);
    return NextResponse.json({ error: err.message || 'Failed to delete staff member' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, slug, name, roleBase, contactInfo, staffCode, attendancePin } = body;

    if (!id || !slug) {
      return NextResponse.json({ error: 'id and slug are required' }, { status: 400 });
    }

    const tenant = await resolveTenant(slug);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const auth = await getTenantUserFromCookies(tenant.id);
    if (!auth || auth.user.role !== 'school_admin') {
      return NextResponse.json({ error: 'Only school admin can update staff members' }, { status: 403 });
    }

    const db = getTenantDb(tenant.id);
    const existing = await db.staff.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
    }

    const updatedStaff = await db.staff.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(roleBase !== undefined && { roleBase: roleBase as StaffRole }),
        ...(contactInfo !== undefined && { contactInfo }),
        ...(staffCode !== undefined && { staffCode: staffCode ? staffCode.trim() : null }),
        ...(attendancePin !== undefined && { attendancePin: attendancePin ? attendancePin.trim() : '1234' }),
      },
    });

    // If roleBase changed, sync tenantUser role
    if (roleBase && ['teacher', 'admin'].includes(roleBase)) {
      const targetRole: TenantUserRole = roleBase === 'admin' ? 'school_admin' : 'teacher';
      await prisma.tenantUser.updateMany({
        where: { tenantId: tenant.id, staffId: id },
        data: { role: targetRole },
      });
    }

    return NextResponse.json({ success: true, staff: updatedStaff });
  } catch (err: any) {
    console.error('Update staff error:', err);
    return NextResponse.json({ error: err.message || 'Failed to update staff member' }, { status: 500 });
  }
}

