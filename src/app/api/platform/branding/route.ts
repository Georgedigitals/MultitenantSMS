import { NextResponse } from 'next/server';
import { getPublicSiteCmsConfig } from '@/lib/public-site-cms';

export const dynamic = 'force-dynamic';

export async function GET() {
  const config = await getPublicSiteCmsConfig();
  return NextResponse.json(config.brand);
}
