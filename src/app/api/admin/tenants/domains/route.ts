import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import prisma from '@/lib/prisma';
import { getSuperAdminFromCookies } from '@/lib/auth/super-admin-auth';
import { tenantHasFeature } from '@/lib/features';

/**
 * POST /api/admin/tenants/domains
 * Add a custom domain alias (e.g., apexacademy.com) for a school tenant.
 * 
 * DELETE /api/admin/tenants/domains?id=aliasId
 * Remove a custom domain alias.
 */
export async function POST(req: NextRequest) {
  const auth = await getSuperAdminFromCookies();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { tenantId, domain } = body;

    if (!tenantId || !domain?.trim()) {
      return NextResponse.json({ error: 'tenantId and domain are required' }, { status: 400 });
    }

    const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/:\d+$/, '').replace(/\/$/, '');
    if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(cleanDomain)) {
      return NextResponse.json({ error: 'Enter a valid public domain name without a path or port.' }, { status: 400 });
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }
    if (!(await tenantHasFeature(tenant.id, 'custom_domain'))) {
      return NextResponse.json({ error: 'Custom domains are available on the Enterprise plan.' }, { status: 403 });
    }

    // Check if domain is already registered to another tenant
    const existing = await prisma.domainAlias.findUnique({
      where: { domain: cleanDomain },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Domain "${cleanDomain}" is already associated with another school.` },
        { status: 409 }
      );
    }

    const alias = await prisma.domainAlias.create({
      data: {
        tenantId,
        domain: cleanDomain,
        verificationToken: randomBytes(24).toString('hex'),
      },
    });

    return NextResponse.json({
      success: true,
      alias: { id: alias.id, tenantId: alias.tenantId, domain: alias.domain, verifiedAt: alias.verifiedAt },
      dnsVerification: {
        type: 'TXT',
        name: `_bms-verification.${cleanDomain}`,
        value: alias.verificationToken,
      },
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to add domain alias' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await getSuperAdminFromCookies();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id query parameter is required' }, { status: 400 });
    }

    await prisma.domainAlias.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Domain alias removed' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to remove domain alias' }, { status: 500 });
  }
}
