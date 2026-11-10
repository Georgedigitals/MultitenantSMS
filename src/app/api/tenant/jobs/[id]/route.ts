import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess } from '@/lib/auth/tenant-access';
import { getJobStatus, retryJob } from '@/lib/queue/job-queue';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');

    if (!slug) {
      return NextResponse.json({ error: 'Tenant slug is required' }, { status: 400 });
    }

    const access = await requireTenantAccess(slug, ['school_admin', 'teacher']);
    if (!access.authorized || !access.tenant) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 403 });
    }

    const job = await getJobStatus(access.tenant.id, id);

    return NextResponse.json({ job });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch job status' },
      { status: 404 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { slug } = body;

    if (!slug) {
      return NextResponse.json({ error: 'Tenant slug is required' }, { status: 400 });
    }

    const access = await requireTenantAccess(slug, ['school_admin']);
    if (!access.authorized || !access.tenant) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 403 });
    }

    const retriedJob = await retryJob(access.tenant.id, id);

    return NextResponse.json({
      success: true,
      message: 'Job re-enqueued for retry successfully',
      job: retriedJob,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to retry job' },
      { status: 400 }
    );
  }
}
