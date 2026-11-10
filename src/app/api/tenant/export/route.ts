import { NextRequest, NextResponse } from 'next/server';
import { getTenantUserFromCookies, TENANT_COOKIE_NAME } from '@/lib/auth/tenant-auth';
import { getSuperAdminFromCookies } from '@/lib/auth/super-admin-auth';
import { getTenantContext } from '@/lib/tenant';
import {
  exportTenantDataJSON,
  exportTenantStudentsCSV,
  exportTenantResultsCSV,
  exportTenantFeesCSV,
} from '@/lib/export';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug') || req.headers.get('x-tenant-slug');
    const tenantIdParam = searchParams.get('tenantId');
    const format = searchParams.get('format') || 'json';
    const type = searchParams.get('type') || 'full';

    // 1. Resolve target tenant
    let tenantId = tenantIdParam;
    let tenantSlug = slug;

    if (!tenantId && slug) {
      const tenantCtx = await getTenantContext({ slug });
      if (tenantCtx) {
        tenantId = tenantCtx.id;
      }
    }

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId or slug is required' }, { status: 400 });
    }

    // 2. Validate Tenant Scoping / Auth (§11.1, §11.8)
    // Check if Super Admin impersonation or Super Admin session
    const superAdminAuth = await getSuperAdminFromCookies();
    let isAuthorized = false;

    if (superAdminAuth) {
      isAuthorized = true;
    } else {
      const auth = await getTenantUserFromCookies(tenantId);
      if (auth) {
        if (auth.user.role === 'school_admin') {
          isAuthorized = true;
        } else if (auth.user.role === 'teacher') {
          // Teachers may only export student rosters and academic results, never financial fees or full JSON dumps
          if (format === 'csv' && (type === 'students' || type === 'results')) {
            isAuthorized = true;
          } else {
            return NextResponse.json(
              { error: 'Forbidden: Teachers are not authorized to export financial ledgers or system backups' },
              { status: 403 }
            );
          }
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized cross-tenant access' }, { status: 401 });
    }

    // 3. Generate requested export content
    const timestamp = new Date().toISOString().split('T')[0];

    if (format === 'csv') {
      let csvData = '';
      let filename = `export-${tenantSlug || tenantId}-${type}-${timestamp}.csv`;

      if (type === 'students') {
        csvData = await exportTenantStudentsCSV(tenantId);
      } else if (type === 'results') {
        csvData = await exportTenantResultsCSV(tenantId);
      } else if (type === 'fees') {
        csvData = await exportTenantFeesCSV(tenantId);
      } else {
        return NextResponse.json(
          { error: 'Invalid CSV type. Must be students, results, or fees' },
          { status: 400 }
        );
      }

      return new NextResponse(csvData, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // Default: JSON Export
    const jsonData = await exportTenantDataJSON(tenantId);
    const filename = `bms-export-${tenantSlug || tenantId}-${timestamp}.json`;

    return new NextResponse(JSON.stringify(jsonData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to generate data export' },
      { status: 500 }
    );
  }
}
