'use client';

interface DashboardNavProps {
  slug?: string;
  role?: string;
}

/**
 * DashboardNav is now integrated globally via the TenantSidebar layout wrapper
 * in src/app/[slug]/dashboard/layout.tsx. This component returns null to preserve
 * backwards compatibility for any inline calls within sub-pages.
 */
export default function DashboardNav(_props?: DashboardNavProps) {
  return null;
}
