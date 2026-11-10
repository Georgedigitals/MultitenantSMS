import React from 'react';
import prisma from '@/lib/prisma';
import { SchoolsDirectoryClient, SchoolTenant } from './schools-directory-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Find Your School Portal | BMS',
  description: 'Search the BMS directory to find a Nigerian school website, parent portal or results page.',
};

export default async function SchoolsDirectoryPage() {
  let schools: SchoolTenant[] = [];
  let directoryAvailable = true;

  try {
    const tenants = await prisma.tenant.findMany({
      where: { status: { in: ['active', 'trial'] } },
      include: {
        lowestClassLevel: { select: { name: true, orderIndex: true } },
        highestClassLevel: { select: { name: true, orderIndex: true } },
      },
      orderBy: { name: 'asc' },
    });

    schools = tenants.map((tenant) => {
      let branding: Record<string, unknown> = {};
      if (tenant.branding && typeof tenant.branding === 'object' && !Array.isArray(tenant.branding)) {
        branding = tenant.branding as Record<string, unknown>;
      } else if (typeof tenant.branding === 'string') {
        try {
          const parsed: unknown = JSON.parse(tenant.branding);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            branding = parsed as Record<string, unknown>;
          }
        } catch {
          // Invalid optional branding should not prevent a school from appearing.
        }
      }

      return {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        lowestClass: tenant.lowestClassLevel?.name || null,
        highestClass: tenant.highestClassLevel?.name || null,
        primaryColor: typeof branding.primaryColor === 'string' ? branding.primaryColor : '#17834b',
        logoUrl: typeof branding.logoUrl === 'string' ? branding.logoUrl : null,
        createdAt: tenant.createdAt.toISOString(),
      };
    });
  } catch (error) {
    directoryAvailable = false;
    console.error('[SchoolsDirectoryPage] Failed to load school directory:', error);
  }

  return <SchoolsDirectoryClient initialSchools={schools} directoryAvailable={directoryAvailable} />;
}
