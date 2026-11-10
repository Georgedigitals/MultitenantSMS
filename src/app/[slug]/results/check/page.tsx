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
    <div className="min-h-screen bg-slate-50 print:bg-white print:min-h-0">
      {/* Header with Tenant Branding & Main Website Navigation */}
      <header
        className="w-full text-white py-5 px-4 sm:px-8 shadow-md mb-8 sticky top-0 z-40 print:hidden"
        style={{ backgroundColor: brandColor }}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-3 group hover:opacity-95 transition-opacity">
            {(tenant.branding as any)?.logoUrl ? (
              <img
                src={(tenant.branding as any).logoUrl}
                alt={tenant.name}
                className="h-10 w-10 object-contain rounded-xl bg-white p-1 shadow-xs"
              />
            ) : (
              <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center font-black text-white text-lg">
                {tenant.name.substring(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white group-hover:underline flex items-center gap-1.5">
                {tenant.name}
                <span className="text-[10px] font-normal opacity-75 font-mono">↗ Main Site</span>
              </h1>
              <p className="text-xs text-white/80 font-medium">Official Online Result Checker Portal</p>
            </div>
          </Link>

          <div className="flex items-center gap-2.5">
            <Link
              href="/"
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white/15 hover:bg-white/25 text-white border border-white/20 transition-all backdrop-blur-md shadow-xs flex items-center gap-1.5"
            >
              <span>← Main Website</span>
            </Link>
            <Link
              href="/login"
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-slate-900 hover:bg-slate-100 transition-all shadow-md flex items-center gap-1.5"
            >
              <span>Portal Login</span>
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
