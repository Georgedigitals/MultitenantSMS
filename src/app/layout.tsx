import type { Metadata } from "next";
import React from "react";
import { cookies } from "next/headers";
import { getPublicSiteCmsConfig } from "@/lib/public-site-cms";
import { getPlatformLocalization } from "@/lib/platform-settings";
import { LanguageProvider } from "@/components/language-provider";
import { getLanguageDir, isSupportedLanguage } from "@/lib/i18n/dictionaries";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const cms = await getPublicSiteCmsConfig().catch(() => null);
  const name = cms?.brand?.name || "School Platform";
  const tagline = cms?.brand?.tagline || "Multi-Tenant School Management and Academic Portal";
  const favicon = cms?.brand?.faviconUrl || cms?.brand?.logoUrl || "/favicon.ico";

  return {
    title: {
      default: `${name} — ${tagline}`,
      template: `%s | ${name}`,
    },
    description: tagline,
    icons: {
      icon: [{ url: favicon, sizes: "any" }],
      shortcut: [favicon],
      apple: [favicon],
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [localization, cms, cookieStore] = await Promise.all([
    getPlatformLocalization(),
    getPublicSiteCmsConfig().catch(() => null),
    cookies(),
  ]);

  const cookieLang = cookieStore.get("platform_lang")?.value || "";
  const cookieSeenDefault = cookieStore.get("platform_default_lang_seen")?.value || "";
  const activeLang =
    cookieSeenDefault === localization.defaultLanguage && isSupportedLanguage(cookieLang)
      ? cookieLang
      : localization.defaultLanguage;
  const activeDir = getLanguageDir(activeLang);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: cms?.brand?.name || "School Platform",
    description: cms?.brand?.tagline || "Multi-Tenant School Management Platform",
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
    ...(cms?.brand?.logoUrl ? { image: cms.brand.logoUrl } : {}),
  };

  return (
    <html lang={activeLang} dir={activeDir} className="h-full antialiased" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <LanguageProvider initialLanguage={activeLang} localization={localization}>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
