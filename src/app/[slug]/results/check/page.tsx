import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTenantContext } from '@/lib/tenant';
import { prisma } from '@/lib/prisma';
import ResultCheckerClient from './result-checker-client';

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

  const dbTenant = await prisma.tenant.findUnique({
    where: { id: tenant.id },
    select: {
      pinPrice: true,
      hasOnlinePayment: true,
      hasOnlinePinPayment: true,
      bankName: true,
      bankAccountNumber: true,
      bankAccountName: true,
    },
  });

  const [availablePin, pinGateway] = await Promise.all([
    prisma.generatedPin.findFirst({
      where: { tenantId: tenant.id, studentId: null, soldAt: null, isUsed: false, onlineSaleReference: null, batch: { status: 'completed' } },
      include: { batch: { select: { pricePerPin: true } } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
    prisma.tenantPaymentGateway.findUnique({ where: { tenantId: tenant.id }, select: { enabled: true } }),
  ]);

  // Fetch active terms for dropdown
  const terms = await prisma.term.findMany({
    where: {
      session: { tenantId: tenant.id },
    },
    include: { session: true },
    orderBy: { startDate: 'desc' },
  });

  const currentTermId = tenant.currentSession?.currentTerm?.id || '';

  const formattedTerms = terms.map((t: any) => ({
    id: t.id,
    name: `${t.session.label} — ${t.name}`,
    isCurrent: t.id === currentTermId,
  }));

  const brandColor = (tenant.branding as any)?.primaryColor || '#0F172A';
  const pinPrice = availablePin ? Number(availablePin.batch.pricePerPin) : (dbTenant ? Number(dbTenant.pinPrice) : 1000);
  const hasOnlinePayment = dbTenant?.hasOnlinePayment ?? tenant.hasOnlinePayment ?? true;
  const hasPinStock = Boolean(availablePin && pinGateway?.enabled && dbTenant?.hasOnlinePinPayment);
  const bankDetails = {
    bankName: dbTenant?.bankName || tenant.bankName || null,
    bankAccountNumber: dbTenant?.bankAccountNumber || tenant.bankAccountNumber || null,
    bankAccountName: dbTenant?.bankAccountName || tenant.bankAccountName || null,
  };

  return (
    <div className="min-h-screen bg-[#f4f3f1] text-[#0a0a0a] font-sans print:bg-white print:min-h-0">
      {/* Clean Architectural Header */}
      <header className="w-full bg-white border-b border-[#e4e2dd] mb-8 sticky top-0 z-40 print:hidden">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-4">
          <Link href={`/${tenant.slug}`} className="flex items-center gap-3 min-w-0">
            {(tenant.branding as any)?.logoUrl ? (
              <img
                src={(tenant.branding as any).logoUrl}
                alt={tenant.name}
                className="h-8 w-8 object-contain shrink-0"
              />
            ) : (
              <div
                className="h-8 w-8 rounded-[6px] flex items-center justify-center font-semibold text-white text-xs shrink-0"
                style={{ backgroundColor: brandColor }}
              >
                {tenant.name.substring(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-[15px] font-semibold tracking-[-0.01em] text-[#0a0a0a] truncate">
                {tenant.name}
              </h1>
              <p className="text-[12px] text-[#66645e] truncate">Term result checker</p>
            </div>
          </Link>

          <div className="flex items-center gap-2.5 shrink-0">
            <Link
              href={`/${tenant.slug}`}
              className="h-9 px-3.5 rounded-[6px] text-[13px] font-medium border border-[#d4d1ca] bg-white text-[#0a0a0a] hover:bg-[#f4f3f1] transition-colors inline-flex items-center"
            >
              ← School website
            </Link>
            <Link
              href={`/${tenant.slug}/login`}
              className="h-9 px-4 rounded-[6px] text-[13px] font-medium bg-[#141414] text-white hover:bg-[#2a2a2a] transition-colors inline-flex items-center"
            >
              Portal login
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pb-12 print:p-0 print:m-0 print:max-w-none">
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
        />
      </main>
    </div>
  );
}
