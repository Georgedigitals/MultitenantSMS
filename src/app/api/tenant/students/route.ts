/**
 * GET  /api/tenant/students?slug=apex&sessionId=...
 *   → list all students enrolled in the given session (or all students if no sessionId)
 * POST /api/tenant/students
 *   → create a new student + enrollment in one request
 *
 * All queries are tenant-isolated via getTenantDb (§11.1).
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTenantDb } from '@/lib/tenant-db';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { hashPassword } from '@/lib/auth/passwords';
import { sendWelcomeCredentialsEmail } from '@/lib/email-service';
import { randomBytes } from 'node:crypto';
import { generateNextAdmissionNumber } from '@/lib/admission-number';
import { findTenantBySlugOrDomain } from '@/lib/tenant';
import { generatePasswordResetToken } from '@/lib/auth/password-reset-token';

async function resolveTenant(slug: string | null) {
  if (!slug) return null;
  return findTenantBySlugOrDomain(slug, {
      id: true,
      lowestClassLevelId: true,
      highestClassLevelId: true,
      plan: { select: { studentCeiling: true, name: true } },
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug');
  const sessionId = searchParams.get('sessionId');

  const tenant = await resolveTenant(slug);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['school_admin', 'teacher'].includes(auth.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getTenantDb(tenant.id);

  if (sessionId) {
    // Return students enrolled in a specific session, with their class level
    const rawEnrollments = await db.enrollment.findMany({
      where: { sessionId },
    });
    const sIds = rawEnrollments.map((e: any) => e.studentId);
    const cIds = rawEnrollments.map((e: any) => e.classLevelId);

    let studentsList: any[] = [];
    if (sIds.length > 0) {
      try {
        studentsList = await prisma.$queryRawUnsafe<any[]>(
          `SELECT id, name, tenant_id as "tenantId", admission_number as "admissionNumber", guardian_contact_info as "guardianContactInfo", created_at as "createdAt", updated_at as "updatedAt"
           FROM students WHERE tenant_id = $1 AND id = ANY($2::text[])`,
          tenant.id,
          sIds
        );
      } catch {
        studentsList = await db.student.findMany({ where: { id: { in: sIds } } });
      }
    }

    const classList = cIds.length > 0 ? await prisma.classLevel.findMany({ where: { id: { in: cIds } } }) : [];
    const sMap = new Map(
      studentsList.map((s: any) => {
        const effectiveAdm = s.admissionNumber || (s.guardianContactInfo as any)?.admissionNo || null;
        return [s.id, { ...s, admissionNumber: effectiveAdm }];
      })
    );
    const cMap = new Map(classList.map((c: any) => [c.id, c]));

    const enrollments = rawEnrollments
      .filter((e: any) => sMap.has(e.studentId))
      .map((e: any) => ({
        ...e,
        student: sMap.get(e.studentId)!,
        classLevel: cMap.get(e.classLevelId) || { name: 'Unknown', orderIndex: 0 },
      }))
      .sort((a: any, b: any) => {
        const orderDiff = (a.classLevel.orderIndex || 0) - (b.classLevel.orderIndex || 0);
        if (orderDiff !== 0) return orderDiff;
        return (a.student.name || '').localeCompare(b.student.name || '');
      });
    return NextResponse.json({ students: enrollments });
  }

  // No sessionId: list all students in the tenant
  let rawStudents: any[] = [];
  try {
    rawStudents = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, name, tenant_id as "tenantId", admission_number as "admissionNumber", guardian_contact_info as "guardianContactInfo", created_at as "createdAt", updated_at as "updatedAt"
       FROM students WHERE tenant_id = $1 ORDER BY name ASC`,
      tenant.id
    );
  } catch {
    rawStudents = await db.student.findMany({
      orderBy: { name: 'asc' },
    });
  }
  const studentIds = rawStudents.map((s: any) => s.id);
  const enrollments = studentIds.length > 0
    ? await db.enrollment.findMany({
        where: { studentId: { in: studentIds } },
        orderBy: { createdAt: 'desc' },
      })
    : [];

  const classIds = Array.from(new Set(enrollments.map((e: any) => e.classLevelId))).filter(Boolean);
  const sessionIds = Array.from(new Set(enrollments.map((e: any) => e.sessionId))).filter(Boolean);

  const [classList, sessionList] = await Promise.all([
    classIds.length > 0 ? prisma.classLevel.findMany({ where: { id: { in: classIds } } }) : [],
    sessionIds.length > 0 ? db.academicSession.findMany({ where: { id: { in: sessionIds } } }) : [],
  ]);

  const cMap = new Map(classList.map((c: any) => [c.id, c]));
  const sesMap = new Map(sessionList.map((s: any) => [s.id, s]));

  const enrollmentMap = new Map<string, any[]>();
  for (const e of enrollments) {
    if (!enrollmentMap.has(e.studentId)) enrollmentMap.set(e.studentId, []);
    enrollmentMap.get(e.studentId)!.push({
      ...e,
      classLevel: cMap.get(e.classLevelId) || { name: 'Unknown' },
      session: sesMap.get(e.sessionId) || { label: 'Unknown' },
    });
  }

  const students = rawStudents.map((s: any) => ({
    ...s,
    admissionNumber: s.admissionNumber || (s.guardianContactInfo as any)?.admissionNo || null,
    enrollments: enrollmentMap.get(s.id)?.slice(0, 1) || [],
  }));

  return NextResponse.json({ students });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      slug,
      name,
      admissionNumber,
      guardianContactInfo,
      classLevelId,
      sessionId,
      createStudentAccount,
      studentEmail: rawStudentEmail,
    } = body;

    if (!slug || !name || !classLevelId || !sessionId) {
      return NextResponse.json({ error: 'slug, name, classLevelId, and sessionId are required' }, { status: 400 });
    }
    const guardianEmail = (guardianContactInfo as any)?.email ? String((guardianContactInfo as any).email).trim().toLowerCase() : '';
    const guardianPhone = String((guardianContactInfo as any)?.guardianPhone || (guardianContactInfo as any)?.phone || '').trim();
    if (!guardianEmail && !guardianPhone) {
      return NextResponse.json({ error: 'Add a parent or guardian email or phone number to set up parent portal access and deliver school notices' }, { status: 400 });
    }
    const cleanStudentEmail = rawStudentEmail ? String(rawStudentEmail).trim().toLowerCase() : '';

    const tenant = await resolveTenant(slug);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const auth = await getTenantUserFromCookies(tenant.id);
    if (!auth || auth.user.role !== 'school_admin') {
      return NextResponse.json({ error: 'Only school admin can create students' }, { status: 403 });
    }

    // §4.1 — class level must be within tenant's enabled range
    const classLevel = await prisma.classLevel.findUnique({ where: { id: classLevelId } });
    if (!classLevel) return NextResponse.json({ error: 'Class level not found' }, { status: 404 });

    const [lowest, highest] = await Promise.all([
      tenant.lowestClassLevelId ? prisma.classLevel.findUnique({ where: { id: tenant.lowestClassLevelId } }) : null,
      tenant.highestClassLevelId ? prisma.classLevel.findUnique({ where: { id: tenant.highestClassLevelId } }) : null,
    ]);
    if (lowest && highest && (classLevel.orderIndex < lowest.orderIndex || classLevel.orderIndex > highest.orderIndex)) {
      return NextResponse.json({ error: `Class level "${classLevel.name}" is outside this school's enabled range (${lowest.name} – ${highest.name})` }, { status: 422 });
    }

    const db = getTenantDb(tenant.id);

    // Plan capacity check (§studentCeiling limit)
    const studentCeiling = tenant.plan?.studentCeiling ?? 0;
    if (studentCeiling > 0) {
      const currentCount = await db.student.count();
      if (currentCount >= studentCeiling) {
        return NextResponse.json(
          {
            error: `Student capacity reached for your ${tenant.plan?.name || 'current'} plan (${currentCount}/${studentCeiling} enrolled). Please upgrade your subscription plan to add more students.`
          },
          { status: 422 }
        );
      }
    }

    // Handle Admission Number (auto-generate if omitted, validate uniqueness if provided)
    const sessionObj = await db.academicSession.findUnique({ where: { id: sessionId } });
    if (!sessionObj) return NextResponse.json({ error: 'Academic session not found for this school' }, { status: 404 });

    let finalAdmissionNumber = admissionNumber ? String(admissionNumber).trim() : '';
    if (!finalAdmissionNumber) {
      const academicYear = String(sessionObj.label || '').match(/\b(20\d{2})\b/)?.[1];
      finalAdmissionNumber = await generateNextAdmissionNumber(tenant.id, {
        sessionYear: academicYear || new Date().getFullYear(),
      });
    } else {
      const duplicate = await prisma.$queryRawUnsafe<any[]>(
        `SELECT "id" FROM "students" WHERE "tenant_id" = $1 AND "admission_number" = $2 LIMIT 1`,
        tenant.id,
        finalAdmissionNumber
      );
      if (duplicate && duplicate.length > 0) {
        return NextResponse.json(
          { error: `Admission number "${finalAdmissionNumber}" is already in use by another student in this school.` },
          { status: 409 }
        );
      }
    }

    // Fetch tenant slug for username/email generation
    const tenantRecord = await prisma.tenant.findUnique({
      where: { id: tenant.id },
      select: { id: true, slug: true, name: true },
    });
    if (!tenantRecord) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const contactPayload = {
      ...(guardianContactInfo && typeof guardianContactInfo === 'object' ? guardianContactInfo : {}),
      admissionNo: finalAdmissionNumber,
      ...(cleanStudentEmail ? { studentEmail: cleanStudentEmail } : {}),
    };

    // Create student + enrollment atomically with fail-safe resilience
    let student: any;
    try {
      student = await db.student.create({
        data: {
          tenantId: tenant.id,
          name: name.trim(),
          admissionNumber: finalAdmissionNumber,
          guardianContactInfo: contactPayload,
        },
      });
    } catch (createErr: any) {
      if (String(createErr?.message || '').includes('admissionNumber')) {
        student = await db.student.create({
          data: {
            tenantId: tenant.id,
            name: name.trim(),
            guardianContactInfo: contactPayload,
          },
        });
        if (finalAdmissionNumber) {
          await prisma.$executeRawUnsafe(
            `UPDATE "students" SET "admission_number" = $1 WHERE "id" = $2 AND "tenant_id" = $3`,
            finalAdmissionNumber,
            student.id,
            tenant.id
          );
          student.admissionNumber = finalAdmissionNumber;
        }
      } else {
        throw createErr;
      }
    }

    const enrollment = await db.enrollment.create({
      data: {
        studentId: student.id,
        classLevelId,
        sessionId,
        status: 'active',
      },
    });

    // Age-tiering check:
    // Nursery, KG, Creche, and early Primary (1-3) default to parent-only management (no student portal account needed).
    // Upper Primary & Secondary (Primary 4+, JSS 1+, SSS 1+) default to creating a student portal account.
    const isEarlyYears = (classLevel.orderIndex <= 6) ||
      /nursery|creche|kg|kindergarten|primary\s*[1-3]\b/i.test(classLevel.name);
    const shouldCreateStudentAccount = createStudentAccount !== undefined
      ? Boolean(createStudentAccount)
      : !isEarlyYears;

    let targetUsername: string | null = null;
    let studentInitialPin: string | null = null;

    if (shouldCreateStudentAccount) {
      targetUsername = finalAdmissionNumber.trim().toLowerCase();
      const existingUser = await prisma.tenantUser.findUnique({
        where: { tenantId_username: { tenantId: tenant.id, username: targetUsername } },
      });
      if (existingUser) {
        targetUsername = `${finalAdmissionNumber.trim().toLowerCase()}@${tenantRecord.slug}.edu`;
      }
      const fallbackUsername = await prisma.tenantUser.findUnique({
        where: { tenantId_username: { tenantId: tenant.id, username: targetUsername } },
        select: { id: true },
      });
      if (fallbackUsername) {
        targetUsername = `student-${randomBytes(5).toString('hex')}@${tenantRecord.slug}.edu`;
      }

      // Generate a clean, human-readable 6-digit numeric PIN for the student
      studentInitialPin = Math.floor(100000 + Math.random() * 900000).toString();
      const passwordHash = await hashPassword(studentInitialPin);

      try {
        await prisma.tenantUser.create({
          data: {
            tenantId: tenant.id,
            username: targetUsername,
            passwordHash,
            role: 'student',
            studentId: student.id,
            isActive: true,
          },
        });
      } catch (userErr) {
        console.error('[Student portal account creation error]', userErr);
        return NextResponse.json({ error: 'Student was enrolled, but the portal account could not be created. Please retry account setup from the student record.' }, { status: 500 });
      }

      // If student provided their own email (e.g. secondary student), send credentials directly to student
      if (cleanStudentEmail) {
        sendWelcomeCredentialsEmail({
          tenantId: tenant.id,
          recipientEmail: cleanStudentEmail,
          recipientName: name.trim(),
          role: 'student',
          username: targetUsername,
          password: studentInitialPin,
          slug: tenantRecord.slug,
        }).catch((err) => console.warn('[Student welcome email error]', err));
      }
    }

    // A student's parent portal is a separate account. Create or reuse the
    // school's Guardian record and attach this student explicitly so the
    // parent portal can resolve all of the guardian's wards.
    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = req.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
    const isSubdomain = host.startsWith(`${tenantRecord.slug}.`);

    const parentPortal = await prisma.$transaction(async (tx: any) => {
      const email = guardianEmail || null;
      const phone = guardianPhone || null;
      const normalizePhone = (value: unknown) => String(value || '').replace(/\D/g, '').replace(/^234/, '0');
      const allGuardians = await tx.guardian.findMany({ where: { tenantId: tenant.id } });
      let guardian = allGuardians.find((candidate: any) => {
        const info = (candidate.contactInfo as any) || {};
        const sameEmail = email && String(info.email || '').trim().toLowerCase() === email;
        const samePhone = phone && normalizePhone(info.phone || info.guardianPhone) === normalizePhone(phone);
        return Boolean(sameEmail || samePhone);
      });

      if (!guardian) {
        guardian = await tx.guardian.create({
          data: {
            tenantId: tenant.id,
            name: String((guardianContactInfo as any)?.name || (guardianContactInfo as any)?.guardianName || 'Parent / Guardian').trim(),
            relationship: String((guardianContactInfo as any)?.relationship || 'Parent / Guardian'),
            contactInfo: { email, phone },
          },
        });
      }

      await tx.studentGuardian.upsert({
        where: { studentId_guardianId: { studentId: student.id, guardianId: guardian.id } },
        update: { isPrimaryContact: true },
        create: { studentId: student.id, guardianId: guardian.id, isPrimaryContact: true },
      });

      const info = (guardian.contactInfo as any) || {};
      let parentUser = info.userId
        ? await tx.tenantUser.findFirst({ where: { id: String(info.userId), tenantId: tenant.id, role: 'parent' } })
        : null;
      if (!parentUser) {
        const preferredUsername = email || phone;
        if (preferredUsername) {
          parentUser = await tx.tenantUser.findFirst({ where: { tenantId: tenant.id, username: preferredUsername, role: 'parent' } });
        }
      }
      if (parentUser?.guardianId && parentUser.guardianId !== guardian.id) {
        parentUser = null;
      }

      let isNewAccount = false;
      if (!parentUser) {
        let username = email || phone || `parent-${randomBytes(5).toString('hex')}@${tenantRecord.slug}.edu`;
        const collision = await tx.tenantUser.findUnique({ where: { tenantId_username: { tenantId: tenant.id, username } } });
        if (collision && collision.guardianId !== guardian.id) {
          username = `parent-${randomBytes(6).toString('hex')}@${tenantRecord.slug}.edu`;
        }
        const tempInitPassword = randomBytes(18).toString('base64url');
        parentUser = await tx.tenantUser.create({
          data: {
            tenantId: tenant.id,
            username,
            passwordHash: await hashPassword(tempInitPassword),
            role: 'parent',
            guardianId: guardian.id,
            isActive: true,
          },
        });
        isNewAccount = true;
      } else if (!parentUser.guardianId) {
        parentUser = await tx.tenantUser.update({ where: { id: parentUser.id }, data: { guardianId: guardian.id } });
      }

      const guardianInfo = {
        ...info,
        email: email || info.email || null,
        phone: phone || info.phone || null,
        username: parentUser.username,
        userId: parentUser.id,
      };
      await tx.guardian.update({ where: { id: guardian.id }, data: { contactInfo: guardianInfo } });
      return { guardianId: guardian.id, parentUser, isNewAccount };
    });

    // Generate single-use secure activation link for newly created parent accounts (48 hours validity)
    let activationUrl: string | null = null;
    if (parentPortal.isNewAccount) {
      const activationToken = generatePasswordResetToken(parentPortal.parentUser, 48);
      const activationPath = isSubdomain
        ? `/reset-password?token=${activationToken}&mode=activate`
        : `/${tenantRecord.slug}/reset-password?token=${activationToken}&mode=activate`;
      activationUrl = `${protocol}://${host}${activationPath}`;

      // Send parent activation email with direct one-click setup button (no plain-text passwords!)
      if (guardianEmail) {
        sendWelcomeCredentialsEmail({
          tenantId: tenant.id,
          recipientEmail: guardianEmail,
          recipientName: String((guardianContactInfo as any)?.name || (guardianContactInfo as any)?.guardianName || 'Parent / Guardian'),
          role: 'parent',
          username: parentPortal.parentUser.username,
          activationUrl,
          slug: tenantRecord.slug,
        }).catch((err) => console.warn('[Parent portal welcome email error]', err));
      }

      // Send parent activation SMS if phone number available
      if (guardianPhone) {
        import('@/lib/sms-service').then(({ sendSms }) => {
          sendSms({
            tenantId: tenant.id,
            phone: guardianPhone,
            message: `Dear Parent, your Parent Portal for ${tenantRecord.name} is ready. Click to set your password and access your dashboard: ${activationUrl}`,
          }).catch((smsErr) => console.warn('[Parent activation SMS error]', smsErr));
        }).catch(() => {});
      }
    }

    return NextResponse.json(
      {
        student: {
          ...student,
          admissionNumber: finalAdmissionNumber,
          enrollments: [
            {
              ...enrollment,
              classLevel,
              session: sessionObj || { label: 'Unknown' },
            },
          ],
        },
        studentPortal: shouldCreateStudentAccount
          ? {
              created: true,
              username: targetUsername,
              temporaryPin: studentInitialPin,
              studentEmail: cleanStudentEmail || null,
              emailSent: Boolean(cleanStudentEmail),
            }
          : {
              created: false,
              reason: 'Parent-managed only (Early years / Young learner)',
            },
        parentPortal: {
          linked: true,
          guardianId: parentPortal.guardianId,
          accountCreated: parentPortal.isNewAccount,
          username: parentPortal.parentUser.username,
          activationUrl,
          emailSent: Boolean(guardianEmail && parentPortal.isNewAccount),
          smsSent: Boolean(guardianPhone && parentPortal.isNewAccount),
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('[Create student error]', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to enroll student' },
      { status: 500 }
    );
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
      return NextResponse.json({ error: 'Only school admin can delete student records' }, { status: 403 });
    }

    const db = getTenantDb(tenant.id);

    // Verify student exists in this tenant
    const existing = await db.student.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Student record not found' }, { status: 404 });
    }

    // Permanent hard delete — cascade purges enrollments, results, PINs, payments, user account, bus & cbt records
    await prisma.$transaction(async (tx) => {
      await tx.tenantUser.deleteMany({
        where: { tenantId: tenant.id, studentId: id },
      });
      await tx.studentBusSubscription.deleteMany({
        where: { studentId: id },
      });
      await tx.cbtStudentAttempt.deleteMany({
        where: { studentId: id },
      });
      await tx.pinUsage.deleteMany({
        where: { studentId: id },
      });
      await tx.student.delete({ where: { id } });
    });

    return NextResponse.json({ success: true, message: `Student record "${existing.name}" permanently deleted.` });
  } catch (err: any) {
    console.error('Delete student error:', err);
    return NextResponse.json({ error: err.message || 'Failed to delete student record' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id,
      slug,
      name,
      admissionNo,
      gender,
      dob,
      studentEmail,
      guardianName,
      guardianEmail,
      guardianPhone,
      guardianContactInfo,
      classLevelId,
      sessionId,
    } = body;

    if (!id || !slug) {
      return NextResponse.json({ error: 'id and slug are required' }, { status: 400 });
    }

    const tenant = await resolveTenant(slug);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const auth = await getTenantUserFromCookies(tenant.id);
    if (!auth || !['school_admin', 'admin'].includes(auth.user.role)) {
      return NextResponse.json({ error: 'Only school admins can update student records' }, { status: 403 });
    }

    const db = getTenantDb(tenant.id);

    const existing = await db.student.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const existingContact = (existing.guardianContactInfo as Record<string, any>) || {};
    let targetAdmissionNo: string | null | undefined = undefined;
    const rawAdm = admissionNo !== undefined ? admissionNo : body.admissionNumber;
    if (rawAdm !== undefined) {
      const cleanAdm = rawAdm ? String(rawAdm).trim() : null;
      if (cleanAdm) {
        if (cleanAdm !== existing.admissionNumber) {
          const duplicate = await prisma.$queryRawUnsafe<any[]>(
            `SELECT "id" FROM "students" WHERE "tenant_id" = $1 AND "admission_number" = $2 AND "id" != $3 LIMIT 1`,
            tenant.id,
            cleanAdm,
            id
          );
          if (duplicate && duplicate.length > 0) {
            return NextResponse.json(
              { error: `Admission number "${cleanAdm}" is already assigned to another student.` },
              { status: 409 }
            );
          }
        }
        targetAdmissionNo = cleanAdm;
      } else {
        // If left empty and student doesn't have an admission number, auto-generate one
        if (!existing.admissionNumber) {
          const { generateNextAdmissionNumber } = await import('@/lib/admission-number');
          targetAdmissionNo = await generateNextAdmissionNumber(tenant.id);
        } else {
          // Keep existing admission number — never erase to null when form submits blank
          targetAdmissionNo = existing.admissionNumber;
        }
      }
    }

    const incomingContact = guardianContactInfo !== undefined && typeof guardianContactInfo === 'object' ? guardianContactInfo : {};
    const newContactInfo = {
      ...existingContact,
      ...incomingContact,
      ...(targetAdmissionNo !== undefined && { admissionNo: targetAdmissionNo }),
      ...(gender !== undefined && { gender }),
      ...(dob !== undefined && { dob }),
      ...(studentEmail !== undefined && { studentEmail: studentEmail ? studentEmail.trim().toLowerCase() : null }),
      ...(guardianName !== undefined && { guardianName: guardianName ? guardianName.trim() : null }),
      ...(guardianEmail !== undefined && { guardianEmail: guardianEmail ? guardianEmail.trim() : null }),
      ...(guardianPhone !== undefined && { guardianPhone: guardianPhone ? guardianPhone.trim() : null }),
    };

    // Update Student record with fail-safe resilience
    let updatedStudent: any;
    try {
      updatedStudent = await db.student.update({
        where: { id },
        data: {
          ...(name !== undefined && { name: name.trim() }),
          ...(targetAdmissionNo !== undefined && { admissionNumber: targetAdmissionNo }),
          guardianContactInfo: newContactInfo,
        },
      });
    } catch (updateErr: any) {
      if (String(updateErr?.message || '').includes('admissionNumber')) {
        // Dev server in-memory chunk lacks newly added column — update via raw SQL
        if (targetAdmissionNo !== undefined) {
          await prisma.$executeRawUnsafe(
            `UPDATE "students" SET "admission_number" = $1, "updated_at" = NOW() WHERE "id" = $2 AND "tenant_id" = $3`,
            targetAdmissionNo,
            id,
            tenant.id
          );
        }
        updatedStudent = await db.student.update({
          where: { id },
          data: {
            ...(name !== undefined && { name: name.trim() }),
            guardianContactInfo: newContactInfo,
          },
        });
        if (targetAdmissionNo !== undefined) {
          updatedStudent.admissionNumber = targetAdmissionNo;
        }
      } else {
        throw updateErr;
      }
    }

    // Update or re-assign class level enrollment if classLevelId and sessionId are provided
    if (classLevelId && sessionId) {
      const existingEnrollment = await db.enrollment.findFirst({
        where: { studentId: id, sessionId },
      });

      if (existingEnrollment) {
        await db.enrollment.update({
          where: { id: existingEnrollment.id },
          data: { classLevelId },
        });
      } else {
        await db.enrollment.create({
          data: {
            studentId: id,
            sessionId,
            classLevelId,
          },
        });
      }
    }

    return NextResponse.json({ success: true, student: updatedStudent });
  } catch (err: any) {
    console.error('Update student error:', err);
    return NextResponse.json({ error: err.message || 'Failed to update student' }, { status: 500 });
  }
}

