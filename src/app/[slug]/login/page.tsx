import React from 'react';
import { notFound } from 'next/navigation';
import { getPublicSiteContent } from '@/lib/site-content';
import TenantLoginClient from './tenant-login-client';

export const dynamic = 'force-dynamic';

interface TenantLoginPageProps {
  params: Promise<{ slug: string }>;
}

export default async function TenantLoginPage({ params }: TenantLoginPageProps) {
  const { slug } = await params;

  let siteData: Awaited<ReturnType<typeof getPublicSiteContent>>;
  try {
    siteData = await getPublicSiteContent(slug);
  } catch {
    notFound();
  }

  return (
    <TenantLoginClient
      slug={siteData.tenant.slug}
      schoolName={siteData.tenant.name}
      motto={siteData.hero.motto}
      templateId={siteData.templateId}
      branding={siteData.branding}
    />
  );
}
