import { NextResponse } from 'next/server';
import { getTenantFeatureMap } from '@/lib/features';
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

    const featureData = await getTenantFeatureMap(session.tenantId);
    
    // Return key-value map for quick client consumption
    const featureMap: Record<string, boolean> = {};
    for (const f of featureData.features) {
      featureMap[f.key] = f.enabled;
    }

    return NextResponse.json({
      planName: featureData.planName,
      features: featureMap,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch features' },
      { status: 400 }
    );
  }
}
