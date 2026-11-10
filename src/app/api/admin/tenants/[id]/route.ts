import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSuperAdminFromCookies } from '@/lib/auth/super-admin-auth';

/**
 * DELETE /api/admin/tenants/[id]
 * Permanently purge a school tenant and all associated database records (§11.1).
 * Requires SuperAdmin authentication + slug confirmation payload.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getSuperAdminFromCookies();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { confirmSlug } = body;

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'School tenant not found' }, { status: 404 });
    }

    if (confirmSlug !== tenant.slug) {
      return NextResponse.json(
        { error: `Confirmation mismatch. You must provide exact slug "${tenant.slug}" to permanently delete.` },
        { status: 400 }
      );
    }

    // Permanent hard delete — database foreign keys will cascade purge all tenant records
    await prisma.tenant.delete({
      where: { id: tenant.id },
    });

    return NextResponse.json({
      success: true,
      message: `Tenant "${tenant.name}" (${tenant.slug}) and all associated records were permanently purged.`,
    });
  } catch (error: any) {
    console.error('Error hard-deleting tenant:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to permanently delete tenant.' },
      { status: 500 }
    );
  }
}
