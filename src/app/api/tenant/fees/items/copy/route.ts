import { NextResponse } from 'next/server';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { tenantHasFeature } from '@/lib/features';
import { copyFeeItemsBetweenTerms } from '@/lib/fees';

export async function POST(request: Request) {
  try {
    const auth = await getTenantUserFromCookies();
    if (!auth || (auth.user.role !== 'school_admin' && auth.user.role !== 'teacher')) {
      return NextResponse.json({ error: 'Unauthorized — Admin role required' }, { status: 403 });
    }

    const hasFeature = await tenantHasFeature(auth.tenant.id, 'school_fees');
    if (!hasFeature) {
      return NextResponse.json({ error: 'School fee tracking is not enabled on your plan tier' }, { status: 403 });
    }

    const body = await request.json();
    const { sourceTermId, targetTermId, percentageAdjustment = 0 } = body;

    if (!sourceTermId || !targetTermId) {
      return NextResponse.json(
        { error: 'sourceTermId and targetTermId are required' },
        { status: 400 }
      );
    }

    const createdItems = await copyFeeItemsBetweenTerms(
      auth.tenant.id,
      sourceTermId,
      targetTermId,
      Number(percentageAdjustment) || 0
    );

    return NextResponse.json({
      success: true,
      copiedCount: createdItems.length,
      feeItems: createdItems,
      message: `Successfully copied ${createdItems.length} fee items into the active term.`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

