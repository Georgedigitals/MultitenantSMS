import { NextRequest, NextResponse } from 'next/server';
import { getPublicSiteContent, updateSiteContent } from '@/lib/site-content';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';

async function getSession() {
  const auth = await getTenantUserFromCookies();
  if (!auth) return null;
  return { tenantId: auth.user.tenantId, user: auth.user };
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await getPublicSiteContent(session.tenantId);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch site content' },
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
        { error: 'Forbidden: Only school admins can update site content' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { page, content } = body;

    if (!page || !['home', 'about', 'academics', 'contact', 'admissions'].includes(page)) {
      return NextResponse.json(
        { error: 'Invalid page identifier (must be home, about, academics, contact, or admissions)' },
        { status: 400 }
      );
    }

    const updated = await updateSiteContent(session.tenantId, page, content || {});
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update site content' },
      { status: 400 }
    );
  }
}
