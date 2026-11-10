import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';

const MIME_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  if (!slug || slug.length === 0) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const safeSegments = slug.map((seg) => decodeURIComponent(seg).replace(/[^a-zA-Z0-9._-]/g, ''));
  const filePath = path.resolve(process.cwd(), 'public', 'uploads', ...safeSegments);
  const root = path.resolve(process.cwd(), 'public', 'uploads');

  if (!filePath.startsWith(`${root}${path.sep}`)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_MAP[ext] || 'application/octet-stream';

    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new NextResponse('Not Found', { status: 404 });
  }
}

