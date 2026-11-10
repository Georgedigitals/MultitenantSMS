import { NextResponse } from 'next/server';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { getTenantAuditLogs } from '@/lib/audit';

export async function GET(request: Request) {
  try {
    const auth = await getTenantUserFromCookies();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Strict RBAC: only school administrators can view the audit trail
    if (auth.user.role !== 'school_admin') {
      return NextResponse.json(
        { error: 'Forbidden — School Administrator role required to view audit trail' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || undefined;
    const actorRole = searchParams.get('actorRole') || undefined;
    const entityType = searchParams.get('entityType') || undefined;
    const search = searchParams.get('search') || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20', 10), 100);

    const result = await getTenantAuditLogs(auth.tenant.id, {
      action,
      actorRole,
      entityType,
      search,
      page: isNaN(page) ? 1 : page,
      pageSize: isNaN(pageSize) ? 20 : pageSize,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('[Tenant Audit Logs API Error]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve audit logs' },
      { status: 500 }
    );
  }
}
