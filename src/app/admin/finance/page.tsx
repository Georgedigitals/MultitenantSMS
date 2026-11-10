import React from 'react';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getSuperAdminFromCookies } from '@/lib/auth/super-admin-auth';
import { getPlatformFinancialOverview } from '@/lib/super-admin';
import { FinanceClient } from './finance-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Platform Finance & Revenue | BMS Super Admin',
  description: 'Auditing platform revenue, annual subscription contracts, and result PIN payouts.',
};

export default async function AdminFinancePage() {
  const auth = await getSuperAdminFromCookies();
  if (!auth) {
    redirect('/admin/login');
  }

  let financials: any = {
    platformRevenue: { subscriptionRevenue: 0, pinRevenue: 0, totalPlatformRevenue: 0 },
    tenantFinancials: [],
  };

  try {
    financials = await getPlatformFinancialOverview();
  } catch (err) {
    console.error('Error fetching admin finance data:', err);
  }

  return <FinanceClient financials={financials} />;
}

