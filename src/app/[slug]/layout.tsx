import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTenantContext } from '@/lib/tenant';
import { ImpersonationBanner } from '@/components/impersonation-banner';

interface TenantLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  let tenant: any = null;
  try {
    tenant = await getTenantContext({ slug });
  } catch (_) {}

  if (!tenant) {
    return {
      title: 'School Portal',
    };
  }

  const schoolName = tenant.name || 'School Portal';
  const logoUrl = tenant.branding?.logoUrl || '/favicon.ico';

  return {
    title: {
      default: schoolName,
      template: `%s | ${schoolName}`,
    },
    description: `${schoolName} — School Management and Academic Portal`,
    icons: {
      icon: [
        { url: logoUrl, sizes: 'any' },
      ],
      shortcut: [logoUrl],
      apple: [
        { url: logoUrl },
      ],
    },
  };
}

export default async function TenantLayout({ children, params }: TenantLayoutProps) {
  const { slug } = await params;

  let tenant: any = null;
  try {
    tenant = await getTenantContext({ slug });
  } catch (err: any) {
    console.error(`[TenantLayout] Database error loading tenant "${slug}":`, err?.message || err);
    throw err;
  }

  if (!tenant) {
    notFound();
  }

  const { branding, name } = tenant;

  // Server-injected CSS custom properties
  const cssVariables = {
    '--brand-primary': branding.primaryColor || '#141414',
    '--brand-accent': branding.accentColor || '#1d5fbf',
    '--font-heading': branding.fontHeading || 'var(--font-instrument-serif)',
    '--font-body': branding.fontBody || 'var(--font-geist-sans)',
  } as React.CSSProperties;

  return (
    <div
      style={cssVariables}
      className="min-h-screen flex flex-col bg-[#f4f3f1] font-sans text-[#0a0a0a] antialiased selection:bg-[#141414] selection:text-white"
    >
      <ImpersonationBanner currentTenantSlug={slug} />
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}
