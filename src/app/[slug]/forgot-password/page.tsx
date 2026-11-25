import React from 'react';
import { notFound } from 'next/navigation';
import { getPublicSiteContent } from '@/lib/site-content';
import ForgotPasswordClient from './forgot-password-client';

export const dynamic = 'force-dynamic';

interface ForgotPasswordPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ForgotPasswordPage({ params }: ForgotPasswordPageProps) {
  const { slug } = await params;

  let siteData: Awaited<ReturnType<typeof getPublicSiteContent>>;
  try {
    siteData = await getPublicSiteContent(slug);
  } catch {
    notFound();
  }

  return (
    <ForgotPasswordClient
      slug={siteData.tenant.slug}
      schoolName={siteData.tenant.name}
      motto={siteData.hero.motto}
      templateId={siteData.templateId}
      branding={siteData.branding}
    />
  );
}
