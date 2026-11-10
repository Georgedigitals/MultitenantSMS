import { NextResponse } from 'next/server';
import { getDefaultTrialDays } from '@/lib/platform-settings';

export async function GET() {
  return NextResponse.json({ trialDays: await getDefaultTrialDays() });
}
