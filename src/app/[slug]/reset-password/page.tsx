import React from 'react';
import { notFound } from 'next/navigation';
import { getPublicSiteContent } from '@/lib/site-content';
import ResetPasswordClient from './reset-password-client';

export const dynamic = 'force-dynamic';

interface ResetPasswordPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ResetPasswordPage({ params }: ResetPasswordPageProps) {
  const { slug } = await params;

  let siteData: Awaited<ReturnType<typeof getPublicSiteContent>>;
  try {
    siteData = await getPublicSiteContent(slug);
  } catch {
    notFound();
  }

  return (
    <ResetPasswordClient
      slug={siteData.tenant.slug}
      schoolName={siteData.tenant.name}
      motto={siteData.hero.motto}
      templateId={siteData.templateId}
      branding={siteData.branding}
    />
  );
}
