import { NextResponse } from 'next/server';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { getStudentPromotionRoster, getPromotionEligibility } from '@/lib/promotion';

export async function GET(request: Request) {
  try {
    const auth = await getTenantUserFromCookies();
    if (!auth || (auth.user.role !== 'school_admin' && auth.user.role !== 'teacher')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId query parameter is required' }, { status: 400 });
    }

    const [eligibility, roster] = await Promise.all([
      getPromotionEligibility(auth.tenant.id, sessionId),
      getStudentPromotionRoster(auth.tenant.id, sessionId),
    ]);

    return NextResponse.json({ eligibility, roster });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
