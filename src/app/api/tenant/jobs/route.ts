import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess } from '@/lib/auth/tenant-access';
import { enqueueJob, listTenantJobs } from '@/lib/queue/job-queue';
import { JobType, JobStatus } from '@prisma/client';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    const type = searchParams.get('type') as JobType | undefined;
    const status = searchParams.get('status') as JobStatus | undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);

    if (!slug) {
      return NextResponse.json({ error: 'Tenant slug is required' }, { status: 400 });
    }

    const access = await requireTenantAccess(slug, ['school_admin', 'teacher']);
    if (!access.authorized || !access.tenant) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 403 });
    }

    const result = await listTenantJobs(access.tenant.id, {
      type,
      status,
      page,
      pageSize,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to list background jobs' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, type, payload, maxAttempts } = body;

    if (!slug || !type) {
      return NextResponse.json(
        { error: 'Tenant slug and job type are required' },
        { status: 400 }
      );
    }

    const validTypes = Object.values(JobType);
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid job type. Supported types: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const access = await requireTenantAccess(slug, ['school_admin', 'teacher']);
    if (!access.authorized || !access.tenant) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 403 });
    }

    const job = await enqueueJob({
      tenantId: access.tenant.id,
      type,
      payload: payload || {},
      maxAttempts: maxAttempts ? Number(maxAttempts) : 3,
    });

    return NextResponse.json({
      success: true,
      message: 'Background job enqueued successfully',
      jobId: job.id,
      job,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to enqueue background job' },
      { status: 500 }
    );
  }
}
