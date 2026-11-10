import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTenantBrandingTokens, updateTenantBranding } from '@/lib/branding';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { findTenantBySlugOrDomain } from '@/lib/tenant';

async function getSession() {
  const auth = await getTenantUserFromCookies();
  if (!auth) return null;
  return { tenantId: auth.user.tenantId, user: auth.user };
}

export async function GET(req: NextRequest) {
  try {
    const slug = req.nextUrl.searchParams.get('slug');
    if (slug) {
      const tenant = await findTenantBySlugOrDomain(slug, { id: true, name: true, branding: true });
      if (tenant) {
        return NextResponse.json({
          name: tenant.name,
          branding: tenant.branding,
        });
      }
    }

    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tokens = await getTenantBrandingTokens(session.tenantId);
    return NextResponse.json(tokens);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch branding' },
      { status: 400 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'school_admin') {
      return NextResponse.json(
        { error: 'Forbidden: Only school admins can update branding' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const updated = await updateTenantBranding(session.tenantId, body);

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update branding' },
      { status: 400 }
    );
  }
}
