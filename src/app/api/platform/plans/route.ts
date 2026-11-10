import { NextResponse } from 'next/server';
import { getPlansForDisplay } from '@/lib/platform-settings';

export async function GET() {
  try {
    const plans = await getPlansForDisplay();
    return NextResponse.json({ plans });
  } catch {
    return NextResponse.json({ error: 'Unable to load subscription plans' }, { status: 500 });
  }
}
