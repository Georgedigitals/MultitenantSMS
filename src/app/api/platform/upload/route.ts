import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';
import { detectRasterImage, MAX_IMAGE_UPLOAD_BYTES } from '@/lib/image-upload';
import { storePublicImage } from '@/lib/object-storage';

export async function POST(req: NextRequest) {
  try {
    const contentLength = Number(req.headers.get('content-length') || 0);
    if (contentLength > MAX_IMAGE_UPLOAD_BYTES + 64 * 1024) {
      return NextResponse.json({ error: 'File size exceeds 5MB limit' }, { status: 413 });
    }

    const clientIp = getClientIp(req);
    const rateCheck = await checkRateLimit(`upload_ip_${clientIp}`, { limit: 20, windowSeconds: 600 });
    if (!rateCheck.success) {
      return NextResponse.json(
        { error: 'Too many upload requests. Please slow down.' },
        { status: 429, headers: { 'Retry-After': String(rateCheck.resetSeconds) } }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const category = ((formData.get('category') as string) || 'onboarding')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .substring(0, 20);

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: 'File size exceeds 5MB limit' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const imageType = detectRasterImage(buffer);
    if (!imageType) {
      return NextResponse.json({ error: 'Invalid image content. Upload a JPEG, PNG, WebP, or GIF image.' }, { status: 400 });
    }

    const randomHex = crypto.randomBytes(8).toString('hex');
    const uniqueFileName = `${Date.now()}-${randomHex}.${imageType.extension}`;

    const stored = await storePublicImage(`${category}/${uniqueFileName}`, buffer, imageType.mimeType);

    return NextResponse.json({
      success: true,
      url: stored.url,
      fileName: file.name,
      size: file.size,
    });
  } catch (error: any) {
    console.error('[Platform Upload Error]', error);
    return NextResponse.json(
      { error: error.message || 'Upload failed' },
      { status: 500 }
    );
  }
}
