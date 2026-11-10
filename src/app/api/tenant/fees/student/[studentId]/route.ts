import { NextResponse } from 'next/server';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { tenantHasFeature } from '@/lib/features';
import { calculateStudentFeeBalance } from '@/lib/fees';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const auth = await getTenantUserFromCookies();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const hasFeature = await tenantHasFeature(auth.tenant.id, 'school_fees');
    if (!hasFeature) {
      return NextResponse.json({ error: 'School fee tracking is not enabled on your plan tier' }, { status: 403 });
    }

    const resolvedParams = await params;
    const studentId = resolvedParams.studentId;

    if (auth.user.role === 'student') {
      if (auth.user.studentId !== studentId) {
        return NextResponse.json({ error: 'Forbidden: You can only view your own fee balance' }, { status: 403 });
      }
    } else if (auth.user.role === 'parent') {
      const { getParentWardsForUser } = await import('@/lib/guardian');
      const parentData = await getParentWardsForUser(auth.tenant.id, auth.user);
      if (!parentData.studentIds.includes(studentId)) {
        return NextResponse.json({ error: 'Forbidden: You can only view fee balances for your linked wards' }, { status: 403 });
      }
    }

    const { searchParams } = new URL(request.url);
    const termId = searchParams.get('termId');

    if (!termId) {
      return NextResponse.json({ error: 'termId query parameter is required' }, { status: 400 });
    }

    const feeBalance = await calculateStudentFeeBalance(auth.tenant.id, studentId, termId);
    return NextResponse.json({ feeBalance });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
