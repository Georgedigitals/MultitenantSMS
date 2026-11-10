import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { findTenantBySlugOrDomain } from '@/lib/tenant';
import { hashPassword } from '@/lib/auth/passwords';
import { sendTenantBrandedNotification } from '@/lib/email-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, studentId } = body;

    if (!slug || !studentId) {
      return NextResponse.json({ error: 'slug and studentId are required' }, { status: 400 });
    }

    const tenant = await findTenantBySlugOrDomain(slug, { id: true, name: true, slug: true });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const auth = await getTenantUserFromCookies(tenant.id);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!['school_admin', 'teacher'].includes(auth.user.role)) {
      return NextResponse.json({ error: 'Only administrators and teachers can reset student credentials' }, { status: 403 });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { userAccount: true },
    });

    if (!student || student.tenantId !== tenant.id) {
      return NextResponse.json({ error: 'Student not found in this school' }, { status: 404 });
    }

    // Generate fresh 6-digit numeric PIN
    const temporaryPin = Math.floor(100000 + Math.random() * 900000).toString();
    const newPasswordHash = await hashPassword(temporaryPin);

    let targetUsername = student.admissionNumber?.trim().toLowerCase();
    if (!targetUsername) {
      targetUsername = `std-${student.id.slice(-6).toLowerCase()}`;
    }

    if (student.userAccount) {
      // Update existing user account
      await prisma.tenantUser.update({
        where: { id: student.userAccount.id },
        data: {
          passwordHash: newPasswordHash,
          isActive: true,
        },
      });
      targetUsername = student.userAccount.username;
    } else {
      // Check collision
      const collision = await prisma.tenantUser.findUnique({
        where: { tenantId_username: { tenantId: tenant.id, username: targetUsername } },
      });
      if (collision) {
        targetUsername = `${targetUsername}@${tenant.slug}.edu`;
      }

      await prisma.tenantUser.create({
        data: {
          tenantId: tenant.id,
          username: targetUsername,
          passwordHash: newPasswordHash,
          role: 'student',
          studentId: student.id,
          isActive: true,
        },
      });
    }

    // Dispatch notification to student and/or parent if emails are known
    const gci = (student.guardianContactInfo as Record<string, any>) || {};
    const studentEmail = typeof gci.studentEmail === 'string' && gci.studentEmail.trim() ? gci.studentEmail.trim() : null;
    const guardianEmail = typeof gci.guardianEmail === 'string' && gci.guardianEmail.trim()
      ? gci.guardianEmail.trim()
      : (typeof gci.email === 'string' && gci.email.trim() ? gci.email.trim() : null);

    const notificationText = `Hello,\n\nThe portal access PIN for student "${student.name}" (Username: ${targetUsername}) has been reset by the school administration.\n\nTemporary PIN: ${temporaryPin}\n\nThe student can now sign in to their portal or CBT online exams using this PIN, and can choose a private password under Profile & Security.`;

    if (studentEmail) {
      sendTenantBrandedNotification({
        tenantId: tenant.id,
        recipientEmail: studentEmail,
        recipientName: student.name,
        subject: `Your Portal Login PIN Reset — ${tenant.name}`,
        messageText: notificationText,
      }).catch((err) => console.warn('[Student PIN reset email warning]', err));
    }

    if (guardianEmail && guardianEmail.toLowerCase() !== studentEmail?.toLowerCase()) {
      sendTenantBrandedNotification({
        tenantId: tenant.id,
        recipientEmail: guardianEmail,
        recipientName: 'Parent / Guardian',
        subject: `Notice: Login PIN Reset for ${student.name} — ${tenant.name}`,
        messageText: notificationText,
      }).catch((err) => console.warn('[Guardian PIN reset notice warning]', err));
    }

    return NextResponse.json({
      success: true,
      message: `PIN for ${student.name} has been reset successfully.`,
      temporaryPin,
      username: targetUsername,
      studentName: student.name,
    });
  } catch (error: any) {
    console.error('[Reset Student PIN Error]', error);
    return NextResponse.json({ error: error.message || 'Failed to reset student PIN' }, { status: 500 });
  }
}

