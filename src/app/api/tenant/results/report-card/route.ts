import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { generateStudentReportCard, generateClassReportCards } from '@/lib/report-card';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug') || req.headers.get('x-tenant-slug');
    const studentId = searchParams.get('studentId');
    const classLevelId = searchParams.get('classLevelId');
    const termId = searchParams.get('termId');
    const pinCode = searchParams.get('pinCode') || req.headers.get('x-pin-code') || undefined;

    if (!slug) {
      return NextResponse.json({ error: 'Tenant slug is required' }, { status: 400 });
    }

    if (!termId) {
      return NextResponse.json({ error: 'termId is required' }, { status: 400 });
    }

    const tenant = await getTenantContext({ slug });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const auth = await getTenantUserFromCookies(tenant.id);

    // If not authenticated via staff/admin cookie, verify public PIN clearance
    if (!auth) {
      if (!studentId) {
        return NextResponse.json({ error: 'Unauthorized. Staff session or Student ID required.' }, { status: 401 });
      }
      const { verifyPinAccess } = await import('@/lib/pin');
      const accessCheck = await verifyPinAccess(tenant.id, studentId, termId, pinCode);
      if (!accessCheck.isUnlocked) {
        return NextResponse.json(
          {
            error: accessCheck.error || accessCheck.reason || 'Results access locked. Valid Result PIN required.',
            reason: accessCheck.reason,
            balanceRemaining: accessCheck.balanceRemaining,
            bankDetails: accessCheck.bankDetails,
          },
          { status: accessCheck.reason === 'fees_outstanding' ? 402 : 403 }
        );
      }
    }

    const asyncMode = searchParams.get('async') === 'true';
    const userRole = (auth as any)?.user?.role || (auth as any)?.role;

    if (studentId) {
      const { findStudentByIdOrAdmissionNo } = await import('@/lib/student-resolver');
      const resolvedStudent = await findStudentByIdOrAdmissionNo(tenant.id, studentId.trim());
      if (!resolvedStudent) {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 });
      }

      // Enforce strict ownership for logged-in students and parents
      if (userRole === 'student') {
        if (auth?.user?.studentId !== resolvedStudent.id) {
          return NextResponse.json({ error: 'Forbidden: You can only view your own report card.' }, { status: 403 });
        }
      } else if (userRole === 'parent' && auth?.user) {
        const { getParentWardsForUser } = await import('@/lib/guardian');
        const parentData = await getParentWardsForUser(tenant.id, auth.user);
        if (!parentData.studentIds.includes(resolvedStudent.id)) {
          return NextResponse.json({ error: 'Forbidden: You can only view report cards for your linked wards.' }, { status: 403 });
        }
      }

      // For student/parent roles, enforce ironclad school fee clearance and PIN lock
      if (userRole === 'student' || userRole === 'parent') {
        const { verifyPinAccess } = await import('@/lib/pin');
        const accessCheck = await verifyPinAccess(tenant.id, resolvedStudent.id, termId, pinCode);
        if (!accessCheck.isUnlocked) {
          return NextResponse.json(
            {
              error: accessCheck.error || accessCheck.reason || 'Results access locked.',
              reason: accessCheck.reason,
              balanceRemaining: accessCheck.balanceRemaining,
              bankDetails: accessCheck.bankDetails,
            },
            { status: accessCheck.reason === 'fees_outstanding' ? 402 : 403 }
          );
        }
      }

      // Single student report card
      const reportCard = await generateStudentReportCard(tenant.id, resolvedStudent.id, termId);
      return NextResponse.json({ reportCard });
    } else if (classLevelId) {
      if (!auth || (userRole !== 'school_admin' && userRole !== 'teacher')) {
        return NextResponse.json(
          { error: 'Forbidden: Only school administrators and teachers can generate class report cards.' },
          { status: 403 }
        );
      }
      // If async mode requested, enqueue background worker job
      if (asyncMode) {
        const { enqueueJob } = await import('@/lib/queue/job-queue');
        const job = await enqueueJob({
          tenantId: tenant.id,
          type: 'bulk_report_cards',
          payload: { classLevelId, termId },
        });

        return NextResponse.json({
          queued: true,
          jobId: job.id,
          message: 'Bulk report card compilation has been queued in background worker',
          statusUrl: `/api/tenant/jobs/${job.id}?slug=${slug}`,
        });
      }

      // Synchronous batch class report cards
      const reportCards = await generateClassReportCards(tenant.id, classLevelId, termId);
      return NextResponse.json({ reportCards });
    } else {
      return NextResponse.json(
        { error: 'Either studentId or classLevelId must be provided' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to generate report card' },
      { status: 400 }
    );
  }
}
