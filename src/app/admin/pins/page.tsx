import React from 'react';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getSuperAdminFromCookies } from '@/lib/auth/super-admin-auth';
import { PinsClient } from './pins-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Scratch Card PIN Batches | Super Admin Plane',
};

export default async function AdminPinsPage() {
  const auth = await getSuperAdminFromCookies();
  if (!auth) {
    redirect('/admin/login');
  }

  let pinBatches: any[] = [];
  let totalPins = 0;
  let pinUsages = 0;
  let digitalPinFeeTotal = 0;
  let tenants: any[] = [];

  try {
    const [batchesData, pinsData, usagesData, tenantsData, resultPinsData] = await Promise.all([
      prisma.pinBatch.findMany({
        include: {
          tenant: { select: { name: true, slug: true } },
          _count: { select: { pins: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.generatedPin.count(),
      prisma.pinUsage.count(),
      prisma.tenant.findMany({
        select: { id: true, name: true, slug: true },
        orderBy: { name: 'asc' },
      }),
      prisma.resultPIN.findMany({
        select: { platformFee: true, usesCount: true },
      }),
    ]);

    const digitalPinCount = (resultPinsData || []).length;
    digitalPinFeeTotal = (resultPinsData || []).reduce((acc, p) => acc + Number(p.platformFee || 0), 0);
    const digitalPinUsages = (resultPinsData || []).reduce((acc, p) => acc + (p.usesCount || 0), 0);

    pinBatches = batchesData || [];
    totalPins = (pinsData || 0) + digitalPinCount;
    pinUsages = (usagesData || 0) + digitalPinUsages;
    tenants = tenantsData || [];
  } catch (err) {
    console.error('Error fetching PIN batches data:', err);
  }

  const formattedBatches = pinBatches.map((b) => ({
    id: b.id,
    batchNumber: b.batchNumber,
    quantity: b.quantity || b._count?.pins || 0,
    maxUsesPerPin: b.maxUsesPerPin,
    pricePerPin: Number(b.pricePerPin || 0),
    platformFeeTotal: Number(b.platformFeeTotal || 0),
    createdAt: b.createdAt.toISOString(),
    tenant: b.tenant,
    _count: b._count || { pins: 0 },
  }));

  const batchFeeTotal = formattedBatches.reduce(
    (acc, b) => acc + (b.platformFeeTotal || 0),
    0
  );

  const totalPlatformRevenue = batchFeeTotal + (digitalPinFeeTotal || 0);

  return (
    <PinsClient
      initialBatches={formattedBatches}
      totalPins={totalPins}
      pinUsages={pinUsages}
      totalPlatformRevenue={totalPlatformRevenue}
      tenants={tenants}
    />
  );
}
