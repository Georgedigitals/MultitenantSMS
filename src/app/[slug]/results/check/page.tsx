import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTenantContext } from '@/lib/tenant';
import { getPublicSiteContent } from '@/lib/site-content';
import { getTemplateThemeTokens } from '@/lib/template-theme';
import { TenantPublicHeader } from '@/components/tenant-public-header';
import { TenantPublicFooter } from '@/components/tenant-public-footer';
import { prisma } from '@/lib/prisma';
import ResultCheckerClient from './result-checker-client';

export const dynamic = 'force-dynamic';

export default async function ResultCheckerPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ studentId?: string; termId?: string }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const tenant = await getTenantContext({ slug: resolvedParams.slug });
  if (!tenant) {
    notFound();
  }

  const [siteData, dbTenant, availablePin, pinGateway, terms] = await Promise.all([
    getPublicSiteContent(tenant.id),
    prisma.tenant.findUnique({
      where: { id: tenant.id },
      select: {
        pinPrice: true,
        hasOnlinePayment: true,
        hasOnlinePinPayment: true,
        bankName: true,
        bankAccountNumber: true,
        bankAccountName: true,
      },
    }),
    prisma.generatedPin.findFirst({
      where: {
        tenantId: tenant.id,
        studentId: null,
        soldAt: null,
        isUsed: false,
        onlineSaleReference: null,
        batch: { status: 'completed' },
      },
      include: { batch: { select: { pricePerPin: true } } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
    prisma.tenantPaymentGateway.findUnique({ where: { tenantId: tenant.id }, select: { enabled: true } }),
    prisma.term.findMany({
      where: {
        session: { tenantId: tenant.id },
      },
      include: { session: true },
      orderBy: { startDate: 'desc' },
    }),
  ]);

  const currentTermId = tenant.currentSession?.currentTerm?.id || '';

  const formattedTerms = terms.map((t: any) => ({
    id: t.id,
    name: `${t.session.label} — ${t.name}`,
    isCurrent: t.id === currentTermId,
  }));

  const { branding, templateId, contact } = siteData;
  const primary = branding.primaryColor || '#1D3251';
  const accent = branding.accentColor || '#C8A45D';
  const textOnPrimary = branding.textOnPrimary || '#FFFFFF';
  const theme = getTemplateThemeTokens(templateId, primary, accent);

  const pinPrice = availablePin
    ? Number(availablePin.batch.pricePerPin)
    : dbTenant
      ? Number(dbTenant.pinPrice)
      : 1000;
  const hasOnlinePayment = dbTenant?.hasOnlinePayment ?? tenant.hasOnlinePayment ?? true;
  const hasPinStock = Boolean(availablePin && pinGateway?.enabled && dbTenant?.hasOnlinePinPayment);
  const bankDetails = {
    bankName: dbTenant?.bankName || tenant.bankName || null,
    bankAccountNumber: dbTenant?.bankAccountNumber || tenant.bankAccountNumber || null,
    bankAccountName: dbTenant?.bankAccountName || tenant.bankAccountName || null,
  };

  return (
    <div
      className="min-h-screen flex flex-col text-[#171614] print:bg-white print:min-h-0"
      style={{ backgroundColor: theme.canvasBg }}
    >
      {/* Template-Aware Public Header (hidden when printing report card) */}
      <div className="print:hidden">
        <TenantPublicHeader
          slug={tenant.slug}
          tenantName={tenant.name}
          branding={branding}
          templateId={templateId}
          contact={contact}
        />
      </div>

      {/* Template-Cohesive Brand Header Strip (hidden when printing) */}
      <section
        className="w-full py-12 sm:py-16 text-white print:hidden"
        style={{ backgroundColor: theme.deepBandBg }}
      >
        <div className="max-w-[1140px] mx-auto px-5 sm:px-8 space-y-3">
          <div className="flex items-center gap-2 text-[12px] text-white/70">
            <Link href={`/${tenant.slug}`} className="hover:text-white underline-offset-4 hover:underline">
              Home
            </Link>
            <span>/</span>
            <span>Term Result Checker</span>
          </div>
          <h1 className={`${theme.headingClass} text-[34px] sm:text-[48px] leading-[1.06] text-white`}>
            Term result portal
          </h1>
          <p className="text-[15px] sm:text-[17px] leading-[1.6] text-white/80 max-w-2xl">
            Verify and print official terminal report cards for {tenant.name} using a student admission number and Result PIN.
          </p>
        </div>
      </section>

      {/* Main Checker Workspace */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14 print:p-0 print:m-0 print:max-w-none">
        <ResultCheckerClient
          tenantSlug={tenant.slug}
          tenantName={tenant.name}
          pinPrice={pinPrice}
          terms={formattedTerms}
          initialStudentId={resolvedSearchParams.studentId || ''}
          initialTermId={resolvedSearchParams.termId || currentTermId}
          hasOnlinePayment={hasOnlinePayment}
          hasPinStock={hasPinStock}
          bankDetails={bankDetails}
          primaryColor={primary}
          textOnPrimary={textOnPrimary}
          cardRadius={theme.cardRadius}
          buttonRadius={theme.buttonRadius}
        />
      </main>

      {/* Template-Aware Public Footer (hidden when printing) */}
      <div className="print:hidden">
        <TenantPublicFooter data={siteData} />
      </div>
    </div>
  );
}
