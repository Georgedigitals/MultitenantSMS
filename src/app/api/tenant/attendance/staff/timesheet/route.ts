import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { getStaffTimesheetMetrics } from '@/lib/staff-attendance';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    if (!slug) {
      return NextResponse.json({ error: 'slug parameter is required' }, { status: 400 });
    }

    const tenant = await getTenantContext({ slug });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }
    if (!tenant.hasFeature('staff_attendance')) return NextResponse.json({ error: 'Staff Attendance is not enabled for this school.' }, { status: 403 });

    const auth = await getTenantUserFromCookies(tenant.id);
    if (!auth || auth.user.role !== 'school_admin') {
      return NextResponse.json({ error: 'School admin authorization required' }, { status: 403 });
    }

    // Default to current month if dates not provided
    const now = new Date();
    const defaultStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      .toISOString()
      .split('T')[0];
    const defaultEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))
      .toISOString()
      .split('T')[0];

    const start = startDateParam || defaultStart;
    const end = endDateParam || defaultEnd;

    const data = await getStaffTimesheetMetrics(tenant.id, start, end);
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Error fetching staff timesheet:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch timesheet' }, { status: 500 });
  }
}
