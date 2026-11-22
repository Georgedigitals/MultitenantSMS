'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDownToLine, ArrowRight, CreditCard, Search, TrendingUp, Wallet } from 'lucide-react';
import { PlatformFinancialOverview } from '@/lib/super-admin';
import { useLanguage } from '@/components/language-provider';
import PinSettlementPanel from '../pin-settlement-panel';

interface FinanceClientProps {
  financials: PlatformFinancialOverview;
}

function csvCell(value: string | number) {
  const text = String(value ?? '');
  const safeText = /^[\s\u0000-\u001f]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

function StatusLabel({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const styles: Record<string, string> = {
    active: 'adm-status-active',
    trial: 'adm-status-trial',
    suspended: 'adm-status-error',
    cancelled: 'adm-status-neutral',
    archived: 'adm-status-neutral',
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${styles[normalized] ?? 'adm-status-neutral'}`}>
      {normalized.replaceAll('_', ' ')}
    </span>
  );
}

export function FinanceClient({ financials }: FinanceClientProps) {
  const { formatMoney, localization } = useLanguage();
  const fmtMoney = (amount: number) => formatMoney(amount, 2);
  const fmtShort = (amount: number) => formatMoney(amount, 0);
  const { platformRevenue, tenantFinancials } = financials;
  const [ledgerSearch, setLedgerSearch] = useState('');
  const normalizedSearch = ledgerSearch.trim().toLowerCase();

  const filteredFinancials = useMemo(
    () =>
      tenantFinancials.filter(
        (tenant) =>
          !normalizedSearch ||
          tenant.tenantName.toLowerCase().includes(normalizedSearch) ||
          tenant.tenantSlug.toLowerCase().includes(normalizedSearch) ||
          tenant.planName.toLowerCase().includes(normalizedSearch) ||
          tenant.status.toLowerCase().includes(normalizedSearch)
      ),
    [tenantFinancials, normalizedSearch]
  );

  const handleExport = () => {
    const code = localization.currencyCode;
    const rows = [
      ['School', 'Slug', 'Plan', `Annual Contract Price (${code})`, `Catalog Price (${code})`, 'Status', 'Renewal Date', 'PIN sales', `Platform PIN fee (${code})`],
      ...tenantFinancials.map((tenant) => [
        tenant.tenantName,
        tenant.tenantSlug,
        tenant.planName,
        (tenant.annualContractPrice ?? tenant.planPrice).toFixed(2),
        tenant.planPrice.toFixed(2),
        tenant.status,
        tenant.subscriptionExpiresAt ? new Date(tenant.subscriptionExpiresAt).toLocaleDateString(localization.locale) : 'N/A',
        tenant.pinSalesCount,
        tenant.pinRevenueAmount.toFixed(2),
      ]),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `platform-finance-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const metrics = [
    {
      label: 'Annual subscription revenue',
      value: platformRevenue.subscriptionRevenue,
      detail: 'Contracted annual rates locked for active and trial schools',
      icon: <CreditCard size={18} className="adm-text-accent" aria-hidden="true" />,
    },
    {
      label: 'Platform share of PIN sales',
      value: platformRevenue.pinRevenue,
      detail: 'Platform fee retained from student & school PIN orders',
      icon: <Wallet size={18} className="adm-text-accent" aria-hidden="true" />,
    },
    {
      label: 'Total platform revenue',
      value: platformRevenue.totalPlatformRevenue,
      detail: 'Combined subscription ARR plus PIN revenue',
      total: true,
      icon: <TrendingUp size={18} className="adm-text-accent" aria-hidden="true" />,
    },
  ];

  return (
    <div data-ui="accent-ladder" className="space-y-7">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] adm-text-accent">Platform finance</p>
          <h1 className="mt-2 text-[27px] font-semibold leading-tight tracking-[-0.035em] adm-text-primary sm:text-[30px]">
            Finance & Revenue
          </h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-6 adm-text-secondary">
            Auditing annual school subscriptions, result PIN platform earnings, and reconciling school payout settlements.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExport}
            disabled={tenantFinancials.length === 0}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md border adm-divider px-4 text-[13px] font-medium adm-text-secondary transition-colors adm-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17834b] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ArrowDownToLine size={15} aria-hidden="true" /> Export Ledger CSV
          </button>
          <Link
            href="/admin/plans"
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-[#17834b] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#126b3d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17834b]"
          >
            Manage plan tiers <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </header>

      {/* Top Financial KPI Cards */}
      <section aria-label="Platform revenue metrics" className="adm-card overflow-hidden rounded-xl border">
        <div className="grid grid-cols-1 divide-y divide-[var(--adm-divider)] md:grid-cols-3 md:divide-x md:divide-y-0">
          {metrics.map((metric) => (
            <article key={metric.label} className={`min-w-0 px-5 py-5 sm:px-6 ${metric.total ? 'adm-surface' : ''}`}>
              <div className="flex items-center justify-between">
                <h2 className="text-[12px] font-medium adm-text-secondary">{metric.label}</h2>
                {metric.icon}
              </div>
              <p className={`mt-3 break-words text-[25px] font-semibold leading-none tracking-[-0.035em] tabular-nums sm:text-[28px] ${metric.total ? 'adm-text-accent' : 'adm-text-primary'}`}>
                {fmtMoney(metric.value)}
              </p>
              <p className="mt-2 text-[12px] leading-5 adm-text-muted">{metric.detail}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Result PIN School Payouts Settlement */}
      <PinSettlementPanel />

      {/* School Platform Financial Ledger */}
      <section className="adm-card min-w-0 overflow-hidden rounded-xl border">
        <div className="flex flex-col gap-4 border-b adm-divider px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 className="text-[15px] font-semibold adm-text-primary">School platform subscription ledger</h2>
            <p className="mt-1 text-[12px] leading-5 adm-text-secondary">
              Locked annual contract prices, renewal dates, and platform share of result PIN sales.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative block min-w-0 sm:w-56">
              <span className="sr-only">Search schools, plans or status</span>
              <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 adm-text-muted" />
              <input
                type="search"
                value={ledgerSearch}
                onChange={(event) => setLedgerSearch(event.target.value)}
                placeholder="Search schools or plans…"
                className="adm-input h-10 w-full rounded-md border pl-9 pr-3 text-[13px] outline-none placeholder:text-[#8693a0] focus:border-[#17834b] focus:ring-2 focus:ring-[#17834b]/15"
              />
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-[13px]">
            <thead>
              <tr className="border-b adm-divider text-[11px] font-medium adm-text-muted">
                <th scope="col" className="px-5 py-3 font-medium sm:px-6">School</th>
                <th scope="col" className="px-4 py-3 font-medium">Plan & Contract Rate</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">PINs sold</th>
                <th scope="col" className="px-5 py-3 text-right font-medium sm:px-6">Platform PIN share</th>
                <th scope="col" className="px-4 py-3 font-medium">Status & Renewal</th>
              </tr>
            </thead>
            <tbody>
              {filteredFinancials.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <p className="text-[13px] font-medium adm-text-primary">
                      {tenantFinancials.length === 0 ? 'No schools have registered yet.' : 'No schools match your search.'}
                    </p>
                    <p className="mt-1 text-[12px] adm-text-muted">
                      {tenantFinancials.length === 0 ? 'New school accounts will appear in this ledger.' : 'Try a different school name, plan or status.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredFinancials.map((tenant) => (
                  <tr key={tenant.tenantId} className="border-b adm-divider last:border-b-0 adm-surface-hover">
                    <td className="px-5 py-3.5 sm:px-6">
                      <span className="block font-medium adm-text-primary">{tenant.tenantName}</span>
                      <span className="mt-0.5 block text-[11px] adm-text-muted">/{tenant.tenantSlug}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="block font-medium adm-text-primary">{tenant.planName}</span>
                      <span className="mt-0.5 block text-[11px] font-medium text-[#17834b]">
                        Contract: {fmtShort(tenant.annualContractPrice ?? tenant.planPrice)}/yr
                      </span>
                      {tenant.annualContractPrice && tenant.annualContractPrice !== tenant.planPrice && (
                        <span className="block text-[10px] adm-text-muted">
                          Catalog: {fmtShort(tenant.planPrice)}/yr
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums adm-text-primary">{tenant.pinSalesCount.toLocaleString(localization.locale)}</td>
                    <td className="px-5 py-3.5 text-right font-medium tabular-nums adm-text-accent sm:px-6">{fmtShort(tenant.pinRevenueAmount)}</td>
                    <td className="px-4 py-3.5">
                      <StatusLabel status={tenant.status} />
                      {tenant.subscriptionExpiresAt && (
                        <span className="mt-1 block text-[11px] adm-text-muted">
                          Renews: {new Date(tenant.subscriptionExpiresAt).toLocaleDateString(localization.locale, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t adm-divider px-5 py-3 text-[11px] adm-text-muted sm:px-6">
          Showing {filteredFinancials.length.toLocaleString('en-NG')} of {tenantFinancials.length.toLocaleString('en-NG')} school accounts
        </div>
      </section>
    </div>
  );
}

