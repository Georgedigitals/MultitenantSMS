import { NextRequest, NextResponse } from 'next/server';
import { detectRasterImage, MAX_IMAGE_UPLOAD_BYTES } from '@/lib/image-upload';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';
import crypto from 'node:crypto';
import { storePublicImage } from '@/lib/object-storage';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const contentLength = Number(req.headers.get('content-length') || 0);
    if (contentLength > MAX_IMAGE_UPLOAD_BYTES + 64 * 1024) {
      return NextResponse.json({ error: 'File size exceeds 5MB limit.' }, { status: 413 });
    }

    const rateCheck = await checkRateLimit(`tenant_upload_${getClientIp(req)}`, { limit: 20, windowSeconds: 600 });
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Too many upload requests. Please slow down.' }, {
        status: 429,
        headers: { 'Retry-After': String(rateCheck.resetSeconds) },
      });
    }

    const tenantSlug = req.headers.get('x-tenant-slug');
    const customDomain = req.headers.get('x-custom-domain');
    const tenant = await getTenantContext(tenantSlug ? { slug: tenantSlug } : customDomain ? { domain: customDomain } : {});
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found for this upload host.' }, { status: 404 });
    }
    const tenantUploadLimit = await checkRateLimit(`tenant_upload_daily_${tenant.id}`, {
      limit: 100,
      windowSeconds: 24 * 60 * 60,
    });
    if (!tenantUploadLimit.success) {
      return NextResponse.json({ error: 'This school has reached its daily upload limit.' }, {
        status: 429,
        headers: { 'Retry-After': String(tenantUploadLimit.resetSeconds) },
      });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: 'File size exceeds 5MB limit. Please select a smaller image.' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const imageType = detectRasterImage(buffer);
    if (!imageType) {
      return NextResponse.json({ error: 'Invalid image content. Upload a JPEG, PNG, WebP, or GIF image.' }, { status: 400 });
    }
    const folder = String(formData.get('folder') || 'assets')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '')
      .slice(0, 32) || 'assets';

    // Require authentication for privileged school folders; unauthenticated uploads are restricted to payment proof receipts
    const auth = await getTenantUserFromCookies(tenant.id);
    if (!auth && folder !== 'receipts' && folder !== 'assets') {
      return NextResponse.json({ error: 'Authentication required for this upload.' }, { status: 401 });
    }
    const key = `tenants/${tenant.id}/${folder}/${Date.now()}-${crypto.randomUUID()}.${imageType.extension}`;
    const stored = await storePublicImage(key, buffer, imageType.mimeType);

    return NextResponse.json({
      success: true,
      url: stored.url,
      fileName: file.name,
      fileSize: file.size,
      mimeType: imageType.mimeType,
    });
  } catch (err: any) {
    console.error('[Upload API Error]', err);
    return NextResponse.json(
      { error: err.message || 'Failed to process image upload' },
      { status: 500 }
    );
  }
}
