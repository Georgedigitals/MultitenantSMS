import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { hashPassword } from '@/lib/auth/passwords';
import { sendWelcomeCredentialsEmail } from '@/lib/email-service';
import { recordAuditLog } from '@/lib/audit';
import { getClientIp } from '@/lib/rate-limiter';
import { randomBytes } from 'node:crypto';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    if (!slug) {
      return NextResponse.json({ error: 'Tenant slug is required' }, { status: 400 });
    }

    const tenant = await getTenantContext({ slug });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const auth = await getTenantUserFromCookies(tenant.id);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const guardians = await prisma.guardian.findMany({
      where: { tenantId: tenant.id },
      include: {
        students: {
          include: {
            student: {
              include: {
                enrollments: {
                  include: { classLevel: true },
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ guardians });
  } catch (error: any) {
    console.error('[Get Parents Error]', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch parents' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    if (!slug) {
      return NextResponse.json({ error: 'Tenant slug is required' }, { status: 400 });
    }

    const tenant = await getTenantContext({ slug });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const auth = await getTenantUserFromCookies(tenant.id);
    if (!auth || (auth.user.role !== 'school_admin' && auth.user.role !== 'teacher')) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    const body = await req.json();
    const { name, relationship, phone, email, address, studentIds } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Parent / Guardian name is required' }, { status: 400 });
    }

    const cleanPhone = phone ? String(phone).trim() : null;
    const cleanEmail = email ? String(email).trim().toLowerCase() : null;
    if (!cleanPhone && !cleanEmail) {
      return NextResponse.json({ error: 'Provide a parent email or phone number to deliver portal login details privately' }, { status: 400 });
    }
    const cleanAddress = address ? String(address).trim() : null;
    const cleanRel = relationship ? String(relationship).trim() : 'Parent / Guardian';
    const wardIds: string[] = Array.isArray(studentIds) ? studentIds.filter(Boolean) : [];

    const clientIp = getClientIp(req);

    // Atomically create guardian and link wards
    const createdGuardian = await prisma.$transaction(async (tx: any) => {
      const guardian = await tx.guardian.create({
        data: {
          tenantId: tenant.id,
          name: name.trim(),
          relationship: cleanRel,
          contactInfo: {
            phone: cleanPhone,
            email: cleanEmail,
            address: cleanAddress,
          },
        },
      });

      // Link selected student wards
      for (const studentId of wardIds) {
        // Verify student belongs to this tenant
        const student = await tx.student.findFirst({
          where: { id: studentId, tenantId: tenant.id },
        });

        if (student) {
          await tx.studentGuardian.upsert({
            where: {
              studentId_guardianId: {
                studentId,
                guardianId: guardian.id,
              },
            },
            update: { isPrimaryContact: true },
            create: {
              studentId,
              guardianId: guardian.id,
              isPrimaryContact: true,
            },
          });

          // Update student.guardianContactInfo for backwards compatibility
          await tx.student.update({
            where: { id: studentId },
            data: {
              guardianContactInfo: {
                guardianName: name.trim(),
                relationship: cleanRel,
                phone: cleanPhone,
                email: cleanEmail,
                address: cleanAddress,
              },
            },
          });
        }
      }

      return guardian;
    });

    await recordAuditLog({
      tenantId: tenant.id,
      actorId: auth.user.id,
      actorName: auth.user.staffProfile?.name || auth.user.username,
      actorRole: auth.user.role,
      action: 'PARENT_REGISTERED',
      entityType: 'Guardian',
      entityId: createdGuardian.id,
      details: {
        guardianName: createdGuardian.name,
        relationship: cleanRel,
        phone: cleanPhone,
        email: cleanEmail,
        linkedWardsCount: wardIds.length,
      },
      ipAddress: clientIp,
    });

    // Create a TenantUser portal login for the parent/guardian
    let portalCredentials: { username: string; emailSent: boolean; smsSent: boolean } | null = null;
    try {
      let targetUsername = cleanEmail || cleanPhone!;

      // Ensure username uniqueness
      const existingUser = await prisma.tenantUser.findUnique({
        where: { tenantId_username: { tenantId: tenant.id, username: targetUsername } },
      });
      if (existingUser) {
        targetUsername = `parent-${randomBytes(5).toString('hex')}@${tenant.slug}.edu`;
      }

      const initialPassword = randomBytes(18).toString('base64url');
      const passwordHash = await hashPassword(initialPassword);

      const newUser = await prisma.tenantUser.create({
        data: {
          tenantId: tenant.id,
          username: targetUsername,
          passwordHash,
          role: 'parent',
          guardianId: createdGuardian.id,
          isActive: true,
        },
      });

      // Update guardian record with linked user account credentials
      await prisma.guardian.update({
        where: { id: createdGuardian.id },
        data: {
          contactInfo: {
            phone: cleanPhone,
            email: cleanEmail,
            address: cleanAddress,
            username: targetUsername,
            userId: newUser.id,
          },
        },
      });

      portalCredentials = {
        username: targetUsername,
        emailSent: false,
        smsSent: Boolean(cleanPhone),
      };

      // 1. Dispatch SMS credentials if parent phone is registered
      if (cleanPhone) {
        import('@/lib/sms-service').then(({ sendSms }) => {
          sendSms({
            tenantId: tenant.id,
            phone: cleanPhone,
            message: `Dear ${name.trim()}, your Parent Portal account for ${tenant.name} is ready! Username: ${targetUsername}, Password: ${initialPassword}. Login at: /${tenant.slug}/login`,
          }).catch((smsErr) => console.warn('[Parent welcome SMS error]', smsErr));
        }).catch(() => {});
      }

      // 2. Fire welcome email if email available (non-blocking)
      if (cleanEmail) {
        sendWelcomeCredentialsEmail({
          tenantId: tenant.id,
          recipientEmail: cleanEmail,
          recipientName: name.trim(),
          role: 'parent',
          username: targetUsername,
          password: initialPassword,
          slug: tenant.slug,
        }).then(() => {
          if (portalCredentials) portalCredentials.emailSent = true;
        }).catch((err) => console.warn('[Parent welcome email error]', err));
        portalCredentials.emailSent = Boolean(cleanEmail);
      }
    } catch (credErr) {
      console.warn('[Parent portal account creation warning]', credErr);
    }

    return NextResponse.json({
      success: true,
      guardian: createdGuardian,
      credentials: portalCredentials,
    });
  } catch (error: any) {
    console.error('[Create Parent Error]', error);
    return NextResponse.json({ error: error.message || 'Failed to create parent' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    if (!slug) {
      return NextResponse.json({ error: 'Tenant slug is required' }, { status: 400 });
    }

    const tenant = await getTenantContext({ slug });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const auth = await getTenantUserFromCookies(tenant.id);
    if (!auth || auth.user.role !== 'school_admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { guardianId, name, relationship, phone, email, address, studentIds } = body;

    if (!guardianId) {
      return NextResponse.json({ error: 'guardianId is required' }, { status: 400 });
    }

    const existingGuardian = await prisma.guardian.findFirst({
      where: { id: guardianId, tenantId: tenant.id },
    });

    if (!existingGuardian) {
      return NextResponse.json({ error: 'Parent record not found for this school' }, { status: 404 });
    }

    const cleanPhone = phone !== undefined ? (phone ? String(phone).trim() : null) : (existingGuardian.contactInfo as any)?.phone;
    const cleanEmail = email !== undefined ? (email ? String(email).trim() : null) : (existingGuardian.contactInfo as any)?.email;
    const cleanAddress = address !== undefined ? (address ? String(address).trim() : null) : (existingGuardian.contactInfo as any)?.address;
    const cleanRel = relationship ? String(relationship).trim() : existingGuardian.relationship;
    const cleanName = name ? String(name).trim() : existingGuardian.name;

    await prisma.$transaction(async (tx: any) => {
      await tx.guardian.update({
        where: { id: guardianId },
        data: {
          name: cleanName,
          relationship: cleanRel,
          contactInfo: {
            phone: cleanPhone,
            email: cleanEmail,
            address: cleanAddress,
          },
        },
      });

      if (Array.isArray(studentIds)) {
        // Reset and update student linkages
        await tx.studentGuardian.deleteMany({
          where: { guardianId },
        });

        for (const studentId of studentIds) {
          const student = await tx.student.findFirst({
            where: { id: studentId, tenantId: tenant.id },
          });

          if (student) {
            await tx.studentGuardian.create({
              data: {
                studentId,
                guardianId,
                isPrimaryContact: true,
              },
            });

            await tx.student.update({
              where: { id: studentId },
              data: {
                guardianContactInfo: {
                  guardianName: cleanName,
                  relationship: cleanRel,
                  phone: cleanPhone,
                  email: cleanEmail,
                  address: cleanAddress,
                },
              },
            });
          }
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Update Parent Error]', error);
    return NextResponse.json({ error: error.message || 'Failed to update parent' }, { status: 500 });
  }
}
