import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { recordAuditLog } from '@/lib/audit';
import { getClientIp } from '@/lib/rate-limiter';

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

    const sessions = await prisma.academicSession.findMany({
      where: { tenantId: tenant.id },
      include: {
        terms: {
          orderBy: { startDate: 'asc' },
        },
        _count: {
          select: {
            enrollments: true,
            teachingAssignments: true,
            formTeacherAssignments: true,
          },
        },
      },
      orderBy: { startDate: 'desc' },
    });

    return NextResponse.json({ sessions });
  } catch (error: any) {
    console.error('[Get Sessions Error]', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch sessions' }, { status: 500 });
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
    if (!auth || auth.user.role !== 'school_admin') {
      return NextResponse.json(
        { error: 'Forbidden: Only school administrators can create academic sessions' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { label, startDate, endDate, isCurrent, termPreset, termNames } = body;

    const TERM_PRESET_MAP: Record<string, string[]> = {
      three_terms: ['1st Term', '2nd Term', '3rd Term'],
      two_semesters: ['Fall Semester', 'Spring Semester'],
      four_quarters: ['Quarter 1', 'Quarter 2', 'Quarter 3', 'Quarter 4'],
      three_trimesters: ['1er Trimestre', '2e Trimestre', '3e Trimestre'],
      uk_terms: ['Autumn Term', 'Spring Term', 'Summer Term'],
    };

    const resolvedTermNames: string[] =
      Array.isArray(termNames) && termNames.filter((n: any) => typeof n === 'string' && n.trim()).length > 0
        ? termNames.map((n: string) => n.trim()).filter(Boolean)
        : TERM_PRESET_MAP[String(termPreset || 'three_terms')] || TERM_PRESET_MAP.three_terms;

    if (!label || typeof label !== 'string' || !label.trim()) {
      return NextResponse.json({ error: 'Valid session label is required (e.g. 2025/2026)' }, { status: 400 });
    }

    const parsedStart = startDate ? new Date(startDate) : new Date();
    const parsedEnd = endDate ? new Date(endDate) : new Date(Date.now() + 300 * 24 * 60 * 60 * 1000);

    if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
      return NextResponse.json({ error: 'Valid start and end dates are required' }, { status: 400 });
    }

    if (parsedStart >= parsedEnd) {
      return NextResponse.json({ error: 'Start date must be before end date' }, { status: 400 });
    }

    // Check uniqueness within tenant
    const existing = await prisma.academicSession.findUnique({
      where: {
        tenantId_label: {
          tenantId: tenant.id,
          label: label.trim(),
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `An academic session with label "${label.trim()}" already exists for this school` },
        { status: 400 }
      );
    }

    const clientIp = getClientIp(req);

    // Atomic transaction for session & default terms
    const createdSession = await prisma.$transaction(async (tx: any) => {
      // If marking as current, unset any existing current session
      if (isCurrent) {
        await tx.academicSession.updateMany({
          where: { tenantId: tenant.id, isCurrent: true },
          data: { isCurrent: false },
        });
      }

      const session = await tx.academicSession.create({
        data: {
          tenantId: tenant.id,
          label: label.trim(),
          startDate: parsedStart,
          endDate: parsedEnd,
          isCurrent: Boolean(isCurrent),
        },
      });

      // Distribute term dates evenly across the academic session
      const startMs = parsedStart.getTime();
      const endMs = parsedEnd.getTime();
      const durationMs = endMs - startMs;
      const periodCount = Math.max(1, resolvedTermNames.length);
      const periodDurationMs = Math.floor(durationMs / periodCount);
      const breakGapMs = 7 * 24 * 60 * 60 * 1000;

      const termsData = resolvedTermNames.map((termName, idx) => {
        const pStart = new Date(startMs + periodDurationMs * idx);
        const pEnd =
          idx === periodCount - 1
            ? new Date(endMs)
            : new Date(Math.max(pStart.getTime() + 86400000, startMs + periodDurationMs * (idx + 1) - breakGapMs));
        return {
          sessionId: session.id,
          name: termName,
          startDate: pStart,
          endDate: pEnd,
          isCurrent: Boolean(isCurrent) && idx === 0,
          totalSchoolDays: null,
        };
      });

      for (const t of termsData) {
        await tx.term.create({ data: t });
      }

      return session;
    });

    await recordAuditLog({
      tenantId: tenant.id,
      actorId: auth.user.id,
      actorName: auth.user.staffProfile?.name || auth.user.username,
      actorRole: auth.user.role,
      action: 'ACADEMIC_SESSION_CREATED',
      entityType: 'AcademicSession',
      entityId: createdSession.id,
      details: {
        label: createdSession.label,
        startDate: parsedStart.toISOString(),
        endDate: parsedEnd.toISOString(),
        isCurrent: Boolean(isCurrent),
      },
      ipAddress: clientIp,
    });

    return NextResponse.json({
      success: true,
      session: createdSession,
    });
  } catch (error: any) {
    console.error('[Create Session Error]', error);
    return NextResponse.json({ error: error.message || 'Failed to create academic session' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await getTenantUserFromCookies();
    if (!auth || auth.user.role !== 'school_admin') {
      return NextResponse.json(
        { error: 'Forbidden: Only school administrators can manage academic sessions' },
        { status: 403 }
      );
    }

    const tenantId = auth.user.tenantId;
    const body = await req.json();
    const { action, sessionId, termId } = body;
    const clientIp = getClientIp(req);

    if (action === 'update_term_school_days') {
      const totalSchoolDays = Number(body.totalSchoolDays);
      if (!termId || !Number.isInteger(totalSchoolDays) || totalSchoolDays < 1 || totalSchoolDays > 300) {
        return NextResponse.json({ error: 'Enter a whole number of school days between 1 and 300' }, { status: 400 });
      }

      const targetTerm = await prisma.term.findFirst({
        where: { id: termId, session: { tenantId } },
        include: { session: true },
      });
      if (!targetTerm) return NextResponse.json({ error: 'Term not found for this school' }, { status: 404 });

      const publishedCount = await prisma.resultEntry.count({
        where: { termId, status: 'published' },
      });
      if (publishedCount > 0) {
        return NextResponse.json({ error: 'School days are locked after results are published. Reopen the term results before changing this value.' }, { status: 409 });
      }

      const updateResult = await prisma.term.updateMany({
        where: { id: targetTerm.id, session: { tenantId } },
        data: { totalSchoolDays },
      });
      if (updateResult.count !== 1) {
        return NextResponse.json({ error: 'Term could not be updated' }, { status: 409 });
      }
      const updatedTerm = await prisma.term.findFirst({
        where: { id: targetTerm.id, session: { tenantId } },
        select: { id: true, name: true, totalSchoolDays: true },
      });
      if (!updatedTerm) return NextResponse.json({ error: 'Term not found for this school' }, { status: 404 });

      await recordAuditLog({
        tenantId,
        actorId: auth.user.id,
        actorName: auth.user.staffProfile?.name || auth.user.username,
        actorRole: auth.user.role,
        action: 'TERM_SCHOOL_DAYS_UPDATED',
        entityType: 'Term',
        entityId: updatedTerm.id,
        details: { termName: updatedTerm.name, totalSchoolDays },
        ipAddress: clientIp,
      });

      return NextResponse.json({ success: true, totalSchoolDays: updatedTerm.totalSchoolDays });
    }

    if (action === 'update_term_details') {
      if (!termId) {
        return NextResponse.json({ error: 'termId is required' }, { status: 400 });
      }
      const targetTerm = await prisma.term.findFirst({
        where: { id: termId, session: { tenantId } },
      });
      if (!targetTerm) {
        return NextResponse.json({ error: 'Term not found for this school' }, { status: 404 });
      }

      const updateData: Record<string, any> = {};
      if (typeof body.name === 'string' && body.name.trim()) {
        updateData.name = body.name.trim();
      }
      if (body.nextTermStartsAt !== undefined) {
        if (body.nextTermStartsAt === null || body.nextTermStartsAt === '') {
          updateData.nextTermStartsAt = null;
        } else {
          const parsedNext = new Date(body.nextTermStartsAt);
          if (isNaN(parsedNext.getTime())) {
            return NextResponse.json({ error: 'Invalid next term opening date' }, { status: 400 });
          }
          updateData.nextTermStartsAt = parsedNext;
        }
      }

      if (Object.keys(updateData).length === 0) {
        return NextResponse.json({ error: 'No term updates provided' }, { status: 400 });
      }

      const updated = await prisma.term.update({
        where: { id: targetTerm.id },
        data: updateData,
        select: { id: true, name: true, nextTermStartsAt: true },
      });

      await recordAuditLog({
        tenantId,
        actorId: auth.user.id,
        actorName: auth.user.staffProfile?.name || auth.user.username,
        actorRole: auth.user.role,
        action: 'TERM_DETAILS_UPDATED',
        entityType: 'Term',
        entityId: updated.id,
        details: {
          name: updated.name,
          nextTermStartsAt: updated.nextTermStartsAt ? updated.nextTermStartsAt.toISOString() : null,
        },
        ipAddress: clientIp,
      });

      return NextResponse.json({
        success: true,
        term: {
          id: updated.id,
          name: updated.name,
          nextTermStartsAt: updated.nextTermStartsAt ? updated.nextTermStartsAt.toISOString().slice(0, 10) : '',
        },
      });
    }

    if (action === 'activate_session') {
      if (!sessionId) {
        return NextResponse.json({ error: 'sessionId is required to activate a session' }, { status: 400 });
      }

      const targetSession = await prisma.academicSession.findFirst({
        where: { id: sessionId, tenantId },
        include: { terms: { orderBy: { startDate: 'asc' } } },
      });

      if (!targetSession) {
        return NextResponse.json({ error: 'Academic session not found for this school' }, { status: 404 });
      }

      await prisma.$transaction(async (tx: any) => {
        // Deactivate all sessions for this tenant
        await tx.academicSession.updateMany({
          where: { tenantId, isCurrent: true },
          data: { isCurrent: false },
        });

        // Activate target session
        await tx.academicSession.update({
          where: { id: sessionId },
          data: { isCurrent: true },
        });

        // Deactivate all terms for other sessions
        await tx.term.updateMany({
          where: { session: { tenantId }, isCurrent: true },
          data: { isCurrent: false },
        });

        // Ensure at least one term of the target session is marked current
        const currentTermInTarget = targetSession.terms.find((t: any) => t.isCurrent);
        const termToActivate = currentTermInTarget || targetSession.terms[0];
        if (termToActivate) {
          await tx.term.update({
            where: { id: termToActivate.id },
            data: { isCurrent: true },
          });
        }
      });

      await recordAuditLog({
        tenantId,
        actorId: auth.user.id,
        actorName: auth.user.staffProfile?.name || auth.user.username,
        actorRole: auth.user.role,
        action: 'ACADEMIC_SESSION_ACTIVATED',
        entityType: 'AcademicSession',
        entityId: sessionId,
        details: { label: targetSession.label },
        ipAddress: clientIp,
      });

      return NextResponse.json({
        success: true,
        message: `Academic session ${targetSession.label} is now active`,
        activeSessionId: sessionId,
      });
    }

    if (action === 'activate_term') {
      if (!termId) {
        return NextResponse.json({ error: 'termId is required to activate a term' }, { status: 400 });
      }

      const targetTerm = await prisma.term.findFirst({
        where: { id: termId, session: { tenantId } },
        include: { session: true },
      });

      if (!targetTerm) {
        return NextResponse.json({ error: 'Term not found for this school' }, { status: 404 });
      }

      await prisma.$transaction(async (tx: any) => {
        // Ensure the parent session is also active
        if (!targetTerm.session.isCurrent) {
          await tx.academicSession.updateMany({
            where: { tenantId, isCurrent: true },
            data: { isCurrent: false },
          });
          await tx.academicSession.update({
            where: { id: targetTerm.sessionId },
            data: { isCurrent: true },
          });
        }

        // Deactivate all other terms for this tenant
        await tx.term.updateMany({
          where: { session: { tenantId }, isCurrent: true },
          data: { isCurrent: false },
        });

        // Activate target term
        await tx.term.update({
          where: { id: termId },
          data: { isCurrent: true },
        });
      });

      await recordAuditLog({
        tenantId,
        actorId: auth.user.id,
        actorName: auth.user.staffProfile?.name || auth.user.username,
        actorRole: auth.user.role,
        action: 'TERM_ACTIVATED',
        entityType: 'Term',
        entityId: termId,
        details: {
          termName: targetTerm.name,
          sessionLabel: targetTerm.session.label,
        },
        ipAddress: clientIp,
      });

      return NextResponse.json({
        success: true,
        message: `${targetTerm.name} of ${targetTerm.session.label} is now active`,
        activeTermId: termId,
      });
    }

    return NextResponse.json({ error: 'Invalid action specified' }, { status: 400 });
  } catch (error: any) {
    console.error('[Update Session/Term Error]', error);
    return NextResponse.json({ error: error.message || 'Failed to update session or term' }, { status: 500 });
  }
}
