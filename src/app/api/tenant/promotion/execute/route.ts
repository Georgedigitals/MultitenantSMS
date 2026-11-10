import { NextResponse } from 'next/server';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { executeSessionPromotion } from '@/lib/promotion';
import { recordAuditLog } from '@/lib/audit';
import { getClientIp } from '@/lib/rate-limiter';

export async function POST(request: Request) {
  try {
    const auth = await getTenantUserFromCookies();
    if (!auth || auth.user.role !== 'school_admin') {
      return NextResponse.json({ error: 'Unauthorized — School Admin required' }, { status: 403 });
    }

    const body = await request.json();
    const { fromSessionId, targetSessionId, decisions, ignoreFeeBlock } = body;

    if (!fromSessionId || !targetSessionId || !Array.isArray(decisions)) {
      return NextResponse.json(
        { error: 'fromSessionId, targetSessionId, and decisions array are required' },
        { status: 400 }
      );
    }

    const result = await executeSessionPromotion(
      auth.tenant.id,
      fromSessionId,
      targetSessionId,
      decisions,
      { ignoreFeeBlock }
    );

    const clientIp = getClientIp(request);
    await recordAuditLog({
      tenantId: auth.tenant.id,
      actorId: auth.user.id,
      actorName: auth.user.staffProfile?.name || auth.user.username,
      actorRole: auth.user.role,
      action: 'PROMOTION_EXECUTED',
      entityType: 'AcademicSession',
      entityId: targetSessionId,
      details: {
        fromSessionId,
        targetSessionId,
        studentCount: decisions.length,
        ignoreFeeBlock: !!ignoreFeeBlock,
      },
      ipAddress: clientIp,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
