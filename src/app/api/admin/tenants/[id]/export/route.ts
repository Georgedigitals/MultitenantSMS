import { NextRequest, NextResponse } from 'next/server';
import { getSuperAdminFromCookies } from '@/lib/auth/super-admin-auth';
import prisma from '@/lib/prisma';
import {
  exportTenantDataJSON,
  exportTenantStudentsCSV,
  exportTenantResultsCSV,
  exportTenantFeesCSV,
} from '@/lib/export';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getSuperAdminFromCookies();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: tenantId } = await params;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, slug: true, name: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'json';
    const type = searchParams.get('type') || 'full';
    const timestamp = new Date().toISOString().split('T')[0];

    if (format === 'csv') {
      let csvData = '';
      let filename = `sa-export-${tenant.slug}-${type}-${timestamp}.csv`;

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

    // Default: Full JSON Archive Export
    const jsonData = await exportTenantDataJSON(tenantId);
    const filename = `sa-ndpr-export-${tenant.slug}-${timestamp}.json`;

    return new NextResponse(JSON.stringify(jsonData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to export tenant data' },
      { status: 500 }
    );
  }
}
