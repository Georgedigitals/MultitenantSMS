import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const slug = req.headers.get('x-tenant-slug') || searchParams.get('slug') || undefined;
    const tenant = await getTenantContext({ slug });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }
    if (!tenant.hasFeature('result_pins')) return NextResponse.json({ error: 'Result PINs are not enabled for this school.' }, { status: 403 });

    const auth = await getTenantUserFromCookies(tenant.id);
    const userRole = (auth as any)?.user?.role || (auth as any)?.role;
    if (!auth || userRole !== 'school_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const batch = await prisma.pinBatch.findFirst({
      where: {
        id,
        tenantId: tenant.id,
      },
      include: {
        pins: {
          where: { studentId: null, soldAt: null, isUsed: false, onlineSaleReference: null },
          orderBy: { serialNumber: 'asc' },
          select: {
            id: true,
            serialNumber: true,
            pinCode: true,
            pricePaid: true,
            isUsed: true,
            usesCount: true,
            studentId: true,
            termId: true,
            createdAt: true,
          },
        },
      },
    });

    if (!batch) {
      return NextResponse.json({ error: 'PIN batch not found' }, { status: 404 });
    }

    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = req.nextUrl.protocol || 'http:';
    const portalUrl = `${protocol}//${host}/${tenant.slug}/results/check`;

    return NextResponse.json({
      success: true,
      batch: {
        id: batch.id,
        batchNumber: batch.batchNumber,
        quantity: batch.quantity || batch.pins.length,
        maxUsesPerPin: batch.maxUsesPerPin,
        pricePerPin: Number(batch.pricePerPin),
        platformFeeTotal: Number(batch.platformFeeTotal),
        platformFeePercent: Number(batch.platformFeePercent),
        createdAt: batch.createdAt.toISOString(),
        pins: batch.pins.map((p) => ({
          ...p,
          pricePaid: Number(p.pricePaid),
          createdAt: p.createdAt.toISOString(),
        })),
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        branding: tenant.branding,
        portalUrl,
      },
    });
  } catch (err: any) {
    console.error('[Get PIN Batch Detail Error]', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
