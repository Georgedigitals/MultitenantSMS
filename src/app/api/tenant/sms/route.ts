import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTenantAccess } from '@/lib/auth/tenant-access';
import { getTenantClassLevels } from '@/lib/class-levels';

function extractSlug(request: Request, candidate?: string | null): string | null {
  if (candidate && candidate.trim() !== '' && candidate !== 'undefined' && candidate !== 'null') {
    return candidate.trim();
  }
  const { searchParams } = new URL(request.url);
  const paramSlug = searchParams.get('slug');
  if (paramSlug && paramSlug.trim() !== '' && paramSlug !== 'undefined' && paramSlug !== 'null') {
    return paramSlug.trim();
  }
  const headerSlug = request.headers.get('x-tenant-slug');
  if (headerSlug && headerSlug.trim() !== '' && headerSlug !== 'undefined') {
    return headerSlug.trim();
  }
  const referer = request.headers.get('referer');
  if (referer) {
    try {
      const refUrl = new URL(referer);
      const parts = refUrl.pathname.split('/').filter(Boolean);
      if (parts.length > 0 && parts[0] !== 'api' && parts[0] !== 'admin') {
        return parts[0];
      }
    } catch {}
  }
  return null;
}

export async function GET(request: Request) {
  try {
    const slug = extractSlug(request);

    if (!slug) {
      return NextResponse.json({ error: 'Missing tenant slug' }, { status: 400 });
    }

    const access = await requireTenantAccess(slug, ['school_admin']);
    if (!access.authorized || !access.tenant) {
      return NextResponse.json({ error: access.error || 'Unauthorized access' }, { status: access.statusCode || 403 });
    }

    // Feature entitlement check
    const hasFeature = await access.tenant.hasFeature('feature_sms_alerts');
    if (!hasFeature) {
      return NextResponse.json(
        { error: 'SMS Alerts module is not enabled for your subscription plan' },
        { status: 403 }
      );
    }

    const [config, classes, terms, smsLogs] = await Promise.all([
      prisma.smsConfiguration.findUnique({
        where: { tenantId: access.tenant.id },
      }),
      getTenantClassLevels(access.tenant.id, { filterLegacyByRange: true }).then((rows) =>
        rows.map((r) => ({ id: r.id, name: r.name }))
      ),
      prisma.term.findMany({
        where: { session: { tenantId: access.tenant.id } },
        orderBy: { startDate: 'desc' },
        select: { id: true, name: true, session: { select: { label: true } } },
        take: 12,
      }),
      prisma.smsLog.findMany({
        where: { tenantId: access.tenant.id },
        orderBy: { sentAt: 'desc' },
        take: 100,
      }),
    ]);

    const logs = smsLogs.map((l) => ({
      id: l.id,
      sentAt: l.sentAt.toISOString(),
      phone: l.phone,
      message: l.message,
      status: l.status,
    }));

    const branding = (access.tenant.branding as any) || {};
    const inquiriesPhone = branding.inquiriesPhone || branding.phone || branding.contactPhone || '';

    return NextResponse.json({ config, logs, classes, terms, inquiriesPhone, hasFeature: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch SMS data' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const slug = extractSlug(request, body.slug);
    const { provider, apiKey, senderId, autoResultAlert, autoFeeAlert, autoAbsentAlert, inquiriesPhone } = body;

    if (!slug) {
      return NextResponse.json({ error: 'Missing tenant slug' }, { status: 400 });
    }

    const access = await requireTenantAccess(slug, ['school_admin']);
    if (!access.authorized || !access.tenant) {
      return NextResponse.json({ error: access.error || 'Unauthorized access' }, { status: access.statusCode || 403 });
    }

    if (inquiriesPhone !== undefined) {
      const currentBranding = (access.tenant.branding as any) || {};
      await prisma.tenant.update({
        where: { id: access.tenant.id },
        data: {
          branding: {
            ...currentBranding,
            inquiriesPhone: String(inquiriesPhone || '').trim(),
            phone: String(inquiriesPhone || '').trim(),
          },
        },
      });
    }

    const config = await prisma.smsConfiguration.upsert({
      where: { tenantId: access.tenant.id },
      update: {
        provider: provider || 'termii',
        apiKey: apiKey !== undefined ? apiKey : undefined,
        senderId: senderId || 'SchoolBMS',
        autoResultAlert: autoResultAlert ?? true,
        autoFeeAlert: autoFeeAlert ?? true,
        autoAbsentAlert: autoAbsentAlert ?? false,
      },
      create: {
        tenantId: access.tenant.id,
        provider: provider || 'termii',
        apiKey: apiKey || null,
        senderId: senderId || 'SchoolBMS',
        autoResultAlert: autoResultAlert ?? true,
        autoFeeAlert: autoFeeAlert ?? true,
        autoAbsentAlert: autoAbsentAlert ?? false,
      },
    });

    return NextResponse.json({ config });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update SMS settings' }, { status: 500 });
  }
}

import { enqueueJob } from '@/lib/queue/job-queue';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const slug = extractSlug(request, body.slug);
    const { phone, recipients, message, action } = body;

    if (!slug) {
      return NextResponse.json({ error: 'Missing tenant slug' }, { status: 400 });
    }

    const access = await requireTenantAccess(slug, ['school_admin', 'teacher']);
    if (!access.authorized || !access.tenant) {
      return NextResponse.json({ error: access.error || 'Unauthorized access' }, { status: access.statusCode || 403 });
    }

    const hasFeature = await access.tenant.hasFeature('feature_sms_alerts');
    if (!hasFeature) {
      return NextResponse.json({ error: 'SMS Alerts module disabled' }, { status: 403 });
    }

    // Action: Broadcast published results to class parents
    if (action === 'broadcast_results') {
      const { classLevelId, termId } = body;
      if (!classLevelId || !termId) {
        return NextResponse.json({ error: 'classLevelId and termId are required' }, { status: 400 });
      }

      const enrollments = await prisma.enrollment.findMany({
        where: { classLevelId, status: 'active', student: { tenantId: access.tenant.id } },
        include: {
          student: {
            include: {
              guardians: { include: { guardian: { select: { name: true, contactInfo: true } } } },
            },
          },
        },
      });

      const studentIds = enrollments.map((e) => e.studentId);
      const term = await prisma.term.findUnique({
        where: { id: termId },
        select: { name: true },
      });

      const entries = await prisma.resultEntry.findMany({
        where: { termId, studentId: { in: studentIds }, status: 'published' },
      });

      const { sendResultPublishedAlert, extractParentPhone } = await import('@/lib/sms-service');

      // 1. Calculate dynamic average and total for each student in the class
      const studentMetrics = enrollments.map((enr) => {
        const studentEntries = entries.filter((e) => e.studentId === enr.student.id);
        const total = studentEntries.reduce((sum, e) => {
          const val = typeof (e.scoreData as any)?.total === 'number'
            ? (e.scoreData as any).total
            : Number((e.scoreData as any)?.total) || 0;
          return sum + val;
        }, 0);
        const avg = studentEntries.length > 0 ? total / studentEntries.length : 0;
        return {
          studentId: enr.student.id,
          avg,
          total,
          subjectCount: studentEntries.length,
        };
      });

      // 2. Sort descending by average to determine real class ranking
      const sortedMetrics = [...studentMetrics].sort((a, b) => b.avg - a.avg || b.total - a.total);
      const classSize = enrollments.length;

      const tenantBranding = (access.tenant.branding as any) || {};
      const schoolPhone = tenantBranding.inquiriesPhone || tenantBranding.phone || tenantBranding.contactPhone || null;

      let queuedCount = 0;
      let lastErrorMessage = '';
      for (const enr of enrollments) {
        const st = enr.student;
        const { phone: parentPhone, name: extractedGuardianName } = extractParentPhone(
          st.guardianContactInfo,
          st.guardians
        );
        if (!parentPhone) continue;

        const guardianName = extractedGuardianName;
        const metric = studentMetrics.find((m) => m.studentId === st.id);
        const avg = metric ? Math.round(metric.avg * 10) / 10 : 0;
        const rankIndex = sortedMetrics.findIndex((m) => m.studentId === st.id);
        const position = rankIndex !== -1 && (metric?.subjectCount || 0) > 0 ? rankIndex + 1 : null;

        const checkUrl = `/${slug}/results/check`;

        const result = await sendResultPublishedAlert({
          tenantId: access.tenant.id,
          studentName: st.name,
          guardianName,
          parentPhone,
          schoolName: access.tenant.name,
          termName: term?.name || 'Current Term',
          averageScore: avg,
          position,
          classSize,
          checkUrl,
          schoolPhone,
        }).catch((err) => {
          console.error('[sendResultPublishedAlert Error]', err);
          return null;
        });

        if (result?.success) {
          queuedCount++;
        } else if (result?.error) {
          lastErrorMessage = result.error;
        }
      }

      const totalParentsWithPhone = enrollments.filter((e) => {
        const { phone } = extractParentPhone(e.student.guardianContactInfo, e.student.guardians);
        return !!phone;
      }).length;

      if (queuedCount === 0) {
        return NextResponse.json(
          {
            success: false,
            error: totalParentsWithPhone === 0
              ? 'No registered parent phone numbers found for students in this class. Please record parent contact information first.'
              : `Attempted dispatch for ${totalParentsWithPhone} parents, but all deliveries failed: ${lastErrorMessage || 'Check SMS Gateway credentials or balance.'}`,
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Dispatched result alert SMS to ${queuedCount} parent contact numbers.`,
      });
    }

    const recipientList: string[] = Array.isArray(recipients)
      ? recipients.map((r: any) => String(r || '').trim()).filter(Boolean)
      : (phone ? [String(phone).trim()] : []);

    if (recipientList.length === 0 || !message || !message.trim()) {
      return NextResponse.json(
        { error: 'Missing required fields (valid recipient phone number and message body)' },
        { status: 400 }
      );
    }

    // If multiple recipients are provided, enqueue asynchronous background job
    if (recipientList.length > 1) {
      const job = await enqueueJob({
        tenantId: access.tenant.id,
        type: 'bulk_sms_dispatch',
        payload: { recipients: recipientList, message: message.trim() },
      });

      // Eagerly trigger processJob in background without blocking response
      const { processJob } = await import('@/lib/queue/job-queue');
      void processJob(job.id).catch((err) => console.error('[processJob eager bulk_sms error]', err));

      return NextResponse.json({
        success: true,
        queued: true,
        jobId: job.id,
        message: `Queued SMS broadcast to ${recipientList.length} recipients in background task`,
      });
    }

    const targetPhone = recipientList[0];

    const { sendSms } = await import('@/lib/sms-service');
    const dispatchResult = await sendSms({
      tenantId: access.tenant.id,
      phone: targetPhone,
      message: message.trim(),
    });

    if (!dispatchResult.success) {
      return NextResponse.json(
        {
          success: false,
          status: dispatchResult.status,
          error: dispatchResult.error || 'SMS delivery failed',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      status: dispatchResult.status,
      messageId: dispatchResult.messageId,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to send SMS' }, { status: 500 });
  }
}
