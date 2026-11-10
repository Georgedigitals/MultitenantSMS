import { NextRequest, NextResponse } from 'next/server';
import { addGalleryImage, deleteGalleryImage } from '@/lib/site-content';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { tenantHasFeature } from '@/lib/features';

async function getSession() {
  const auth = await getTenantUserFromCookies();
  if (!auth) return null;
  return { tenantId: auth.user.tenantId, user: auth.user };
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'school_admin') {
      return NextResponse.json(
        { error: 'Forbidden: Only school admins can manage gallery' },
        { status: 403 }
      );
    }
    if (!(await tenantHasFeature(session.tenantId, 'gallery'))) {
      return NextResponse.json({ error: 'The photo gallery is not enabled for this school.' }, { status: 403 });
    }

    const body = await req.json();
    const { imageUrl, caption, album } = body;

    const image = await addGalleryImage(session.tenantId, imageUrl, caption, album);
    return NextResponse.json(image);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to add gallery image' },
      { status: 400 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'school_admin') {
      return NextResponse.json(
        { error: 'Forbidden: Only school admins can manage gallery' },
        { status: 403 }
      );
    }
    if (!(await tenantHasFeature(session.tenantId, 'gallery'))) {
      return NextResponse.json({ error: 'The photo gallery is not enabled for this school.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing image id parameter' }, { status: 400 });
    }

    const result = await deleteGalleryImage(session.tenantId, id);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to delete gallery image' },
      { status: 400 }
    );
  }
}
