import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSuperAdminFromCookies } from '@/lib/auth/super-admin-auth';
import { isBuiltInFeatureKey } from '@/lib/feature-catalog';

// GET all plans with feature mappings
export async function GET(req: NextRequest) {
  try {
    const auth = await getSuperAdminFromCookies();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const plans = await prisma.plan.findMany({
      include: {
        features: { include: { feature: true } },
        _count: { select: { tenants: true } },
      },
      orderBy: { price: 'asc' },
    });

    return NextResponse.json({ success: true, plans });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to fetch plans' }, { status: 500 });
  }
}

// POST create or update a subscription plan
export async function POST(req: NextRequest) {
  try {
    const auth = await getSuperAdminFromCookies();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      id,
      name,
      studentCeiling,
      price,
      pinRequired,
      platformFeePercent,
      featureKeys = [],
    } = body;

    if (!name || studentCeiling === undefined || price === undefined) {
      return NextResponse.json(
        { error: 'Plan name, student ceiling, and price are required' },
        { status: 400 }
      );
    }

    const feePercent = Number(platformFeePercent ?? 0);
    if (!Number.isFinite(feePercent) || feePercent < 0 || feePercent > 100) {
      return NextResponse.json({ error: 'Result PIN platform share must be between 0% and 100%.' }, { status: 400 });
    }

    const planId = id || `plan_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    if (!Array.isArray(featureKeys) || featureKeys.some((key) => typeof key !== 'string')) {
      return NextResponse.json({ error: 'featureKeys must be an array of feature keys.' }, { status: 400 });
    }
    const normalizedFeatureKeys = [...new Set(featureKeys.map((key: string) => key.trim()))];
    if (normalizedFeatureKeys.some((key) => !isBuiltInFeatureKey(key))) {
      return NextResponse.json({ error: 'Plans can only enable capabilities registered in the built-in BMS feature catalogue.' }, { status: 400 });
    }
    const knownFeatures = await prisma.feature.findMany({
      where: { key: { in: normalizedFeatureKeys } },
      select: { key: true },
    });
    if (knownFeatures.length !== normalizedFeatureKeys.length) {
      return NextResponse.json({ error: 'One or more selected features do not exist in the feature registry.' }, { status: 400 });
    }

    // Save the plan and its entitlement set atomically, so partial updates cannot drift.
    const updatedPlan = await prisma.$transaction(async (tx) => {
      const plan = await tx.plan.upsert({
        where: { id: planId },
        create: {
          id: planId,
          name: name.trim(),
          studentCeiling: Number(studentCeiling),
          price: Number(price),
          pinRequired: Boolean(pinRequired),
          platformFeePercent: feePercent,
        },
        update: {
          name: name.trim(),
          studentCeiling: Number(studentCeiling),
          price: Number(price),
          pinRequired: Boolean(pinRequired),
          platformFeePercent: feePercent,
        },
      });

      await tx.planFeature.deleteMany({
        where: { planId: plan.id, featureKey: { notIn: normalizedFeatureKeys } },
      });
      for (const featureKey of normalizedFeatureKeys) {
        await tx.planFeature.upsert({
          where: { planId_featureKey: { planId: plan.id, featureKey } },
          create: { planId: plan.id, featureKey, enabledByDefault: true },
          update: { enabledByDefault: true },
        });
      }

      return tx.plan.findUnique({
        where: { id: plan.id },
        include: { features: { include: { feature: true } }, _count: { select: { tenants: true } } },
      });
    });

    return NextResponse.json({ success: true, plan: updatedPlan });
  } catch (err: any) {
    console.error('Super Admin plan management error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to save plan' }, { status: 500 });
  }
}

// DELETE a subscription plan
export async function DELETE(req: NextRequest) {
  try {
    const auth = await getSuperAdminFromCookies();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const planId = searchParams.get('id');

    if (!planId) {
      return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 });
    }

    // Check if tenants are attached
    const tenantCount = await prisma.tenant.count({
      where: { planId },
    });

    if (tenantCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete plan: ${tenantCount} active school tenant(s) are assigned to this plan. Reassign them first.` },
        { status: 400 }
      );
    }

    // Delete plan features first
    await prisma.planFeature.deleteMany({
      where: { planId },
    });

    // Delete plan
    await prisma.plan.delete({
      where: { id: planId },
    });

    return NextResponse.json({ success: true, message: 'Plan deleted successfully' });
  } catch (err: any) {
    console.error('Super Admin plan deletion error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to delete plan' }, { status: 500 });
  }
}
