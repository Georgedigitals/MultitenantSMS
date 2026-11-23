import { NextRequest, NextResponse } from 'next/server';
import { getSuperAdminFromCookies } from '@/lib/auth/super-admin-auth';
import prisma from '@/lib/prisma';
import { isBuiltInFeatureKey } from '@/lib/feature-catalog';
import {
  getTenantFeatureMap,
  updateTenantPlan,
} from '@/lib/features';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getSuperAdminFromCookies();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: tenantId } = await params;
    const data = await getTenantFeatureMap(tenantId);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch tenant features' },
      { status: 400 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getSuperAdminFromCookies();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: tenantId } = await params;
    const body = await req.json();
    const { action, featureKey, enabled, planId, reason, paymentReference } = body;

    const tenantExists = await prisma.tenant.findUnique({
      where: { id: tenantId }, select: { id: true },
    });
    if (!tenantExists) return NextResponse.json({ error: 'School not found.' }, { status: 404 });

    if (action === 'set_override') {
      if (typeof featureKey !== 'string' || typeof enabled !== 'boolean' || typeof reason !== 'string' || reason.trim().length < 3 || reason.trim().length > 500) {
        return NextResponse.json(
          { error: 'featureKey, enabled, and a reason of 3 to 500 characters are required.' },
          { status: 400 }
        );
      }
      if (!isBuiltInFeatureKey(featureKey)) return NextResponse.json({ error: 'This is not a supported platform module.' }, { status: 400 });
      const feature = await prisma.feature.findUnique({ where: { key: featureKey }, select: { key: true } });
      if (!feature) return NextResponse.json({ error: 'Feature not found.' }, { status: 404 });
      if (typeof paymentReference === 'string' && paymentReference.trim().length > 120) {
        return NextResponse.json({ error: 'Payment reference must be 120 characters or fewer.' }, { status: 400 });
      }

      const admin = auth.superAdmin;
      await prisma.$transaction(async (tx) => {
        await tx.tenantFeatureOverride.upsert({
          where: { tenantId_featureKey: { tenantId, featureKey } },
          update: { enabled },
          create: { tenantId, featureKey, enabled },
        });
        await tx.auditLog.create({
          data: {
            tenantId,
            actorId: admin.id,
            actorName: admin.name,
            actorRole: 'super_admin',
            action: 'feature_override_set',
            entityType: 'tenant_feature_override',
            entityId: `${tenantId}:${featureKey}`,
            details: {
              featureKey,
              enabled,
              reason: reason.trim(),
              paymentReference: typeof paymentReference === 'string' ? paymentReference.trim() || null : null,
            },
            ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
          },
        });
      });
    } else if (action === 'remove_override') {
      if (typeof featureKey !== 'string' || !featureKey) {
        return NextResponse.json({ error: 'featureKey is required' }, { status: 400 });
      }
      if (!isBuiltInFeatureKey(featureKey)) return NextResponse.json({ error: 'This is not a supported platform module.' }, { status: 400 });
      const admin = auth.superAdmin;
      await prisma.$transaction(async (tx) => {
        const removed = await tx.tenantFeatureOverride.deleteMany({ where: { tenantId, featureKey } });
        if (removed.count) {
          await tx.auditLog.create({
            data: {
              tenantId,
              actorId: admin.id,
              actorName: admin.name,
              actorRole: 'super_admin',
              action: 'feature_override_removed',
              entityType: 'tenant_feature_override',
              entityId: `${tenantId}:${featureKey}`,
              details: { featureKey },
              ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
            },
          });
        }
      });
    } else if (action === 'update_plan') {
      if (!planId) {
        return NextResponse.json({ error: 'planId is required' }, { status: 400 });
      }
      await updateTenantPlan(tenantId, planId);
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Must be set_override, remove_override, or update_plan' },
        { status: 400 }
      );
    }

    const updatedMap = await getTenantFeatureMap(tenantId);
    return NextResponse.json(updatedMap);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update tenant feature settings' },
      { status: 400 }
    );
  }
}
