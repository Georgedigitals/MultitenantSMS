import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSuperAdminFromCookies } from '@/lib/auth/super-admin-auth';
import { BUILT_IN_FEATURE_CAPABILITIES, isBuiltInFeatureKey } from '@/lib/feature-catalog';

// GET all global features
export async function GET(req: NextRequest) {
  try {
    const auth = await getSuperAdminFromCookies();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const storedFeatures = await prisma.feature.findMany({
      orderBy: { key: 'asc' },
    });
    const features = storedFeatures.filter((feature) => isBuiltInFeatureKey(feature.key));

    const registeredKeys = new Set(features.map((feature) => feature.key));
    const availableCapabilities = BUILT_IN_FEATURE_CAPABILITIES.filter((capability) => !registeredKeys.has(capability.key));
    return NextResponse.json({ success: true, features, availableCapabilities });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to fetch features' }, { status: 500 });
  }
}

// POST create or update a feature definition
export async function POST(req: NextRequest) {
  try {
    const auth = await getSuperAdminFromCookies();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { key, name, description } = body;

    if (typeof key !== 'string' || typeof name !== 'string' || !key.trim() || !name.trim() || name.trim().length > 100) {
      return NextResponse.json(
        { error: 'Feature key and display name are required' },
        { status: 400 }
      );
    }

    const cleanKey = key.trim().toLowerCase();
    if (!/^[a-z][a-z0-9_]{1,63}$/.test(cleanKey)) {
      return NextResponse.json({ error: 'Feature key must start with a letter and contain only lowercase letters, numbers, and underscores (2–64 characters).' }, { status: 400 });
    }
    if (!isBuiltInFeatureKey(cleanKey)) {
      return NextResponse.json({ error: 'Choose an existing BMS module from the feature catalogue. New custom modules must be implemented and connected in code first.' }, { status: 400 });
    }

    const feature = await prisma.feature.upsert({
      where: { key: cleanKey },
      create: {
        key: cleanKey,
        name: name.trim(),
        description: typeof description === 'string' ? description.trim().slice(0, 500) || null : null,
      },
      update: {
        name: name.trim(),
        description: typeof description === 'string' ? description.trim().slice(0, 500) || null : null,
      },
    });

    return NextResponse.json({ success: true, feature });
  } catch (err: any) {
    console.error('Super Admin feature management error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to save feature' }, { status: 500 });
  }
}

// DELETE a global feature definition
export async function DELETE(req: NextRequest) {
  try {
    const auth = await getSuperAdminFromCookies();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json({ error: 'Feature key is required' }, { status: 400 });
    }

    const [planLinks, tenantOverrides] = await Promise.all([
      prisma.planFeature.count({ where: { featureKey: key } }),
      prisma.tenantFeatureOverride.count({ where: { featureKey: key } }),
    ]);
    if (planLinks || tenantOverrides) {
      return NextResponse.json({
        error: `This feature is assigned to ${planLinks} plan(s) and ${tenantOverrides} school override(s). Remove those assignments before deleting it.`,
      }, { status: 409 });
    }

    await prisma.feature.delete({ where: { key } });

    return NextResponse.json({ success: true, message: 'Feature deleted successfully' });
  } catch (err: any) {
    console.error('Super Admin feature deletion error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to delete feature' }, { status: 500 });
  }
}
