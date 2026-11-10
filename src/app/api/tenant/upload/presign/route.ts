import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';

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

    if (session.user.role !== 'school_admin' && session.user.role !== 'teacher') {
      return NextResponse.json({ error: 'Forbidden: Staff access required' }, { status: 403 });
    }

    const body = await req.json();
    const { fileName, fileType, assetType } = body;

    if (!fileName || !fileType) {
      return NextResponse.json({ error: 'fileName and fileType are required' }, { status: 400 });
    }

    const fileExt = fileName.split('.').pop() || 'png';
    const uploadId = crypto.randomBytes(8).toString('hex');
    const key = `tenants/${session.tenantId}/${assetType || 'assets'}/${uploadId}.${fileExt}`;
    
    // Generates a mock presigned upload URL & public destination URL (§7)
    const publicUrl = `https://cdn.schoolsystem.ng/${key}`;
    const uploadUrl = `https://storage.schoolsystem.ng/upload?key=${encodeURIComponent(key)}&token=${uploadId}`;

    return NextResponse.json({
      key,
      uploadUrl,
      publicUrl,
      expiresIn: 900,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to generate upload URL' },
      { status: 400 }
    );
  }
}
