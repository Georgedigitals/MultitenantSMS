import { NextRequest, NextResponse } from 'next/server';
import { getPendingRegistration } from '@/lib/pending-registrations';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ref = searchParams.get('ref') || searchParams.get('reference') || searchParams.get('slug');

  if (!ref) {
    return NextResponse.json({ error: 'Reference or slug is required' }, { status: 400 });
  }

  const pending = await getPendingRegistration(ref);
  if (!pending) {
    return NextResponse.json({ error: 'Pending registration not found or expired' }, { status: 404 });
  }

  // Return payload excluding password
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash: _passwordHash, ...safePayload } = pending;
  return NextResponse.json({
    success: true,
    data: safePayload,
  });
}
