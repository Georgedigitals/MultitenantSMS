import React from 'react';
import { redirect, notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { getTenantBrandingTokens } from '@/lib/branding';
import { getPublicSiteContent } from '@/lib/site-content';
import WebsiteAdminClient from './website-admin-client';

interface WebsitePageProps {
  params: Promise<{ slug: string }>;
}

export default async function WebsiteAdminPage({ params }: WebsitePageProps) {
  const { slug } = await params;
  const tenant = await getTenantContext({ slug });
  if (!tenant) notFound();

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) {
    redirect('/login');
  }

  if (auth.user.role !== 'school_admin') {
    redirect('/dashboard');
  }

  const branding = await getTenantBrandingTokens(tenant.id);
  const siteData = await getPublicSiteContent(tenant.id);
  const domainAliases = await prisma.domainAlias.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: 'asc' },
  });

  return (
    <WebsiteAdminClient
      tenantSlug={slug}
      tenantName={tenant.name}
      initialBranding={branding}
      initialSiteData={siteData}
      hasWebsiteCmsFeature={true}
      hasGalleryFeature={tenant.hasFeature('gallery')}
      hasCustomDomainFeature={tenant.hasFeature('custom_domain')}
      domainAliases={domainAliases.map((d) => ({
        id: d.id,
        domain: d.domain,
        isPrimary: false,
      }))}
    />
  );
}
