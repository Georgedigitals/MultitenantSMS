'use client';

import React, { useState } from 'react';
import { CheckCircle2, Download, Info, KeyRound, Layers, Wallet } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';

interface PinBatchItem {
  id: string;
  batchNumber: string | null;
  maxUsesPerPin: number;
  pricePerPin: number;
  platformFeeTotal?: number;
  createdAt: string;
  tenant: { name: string; slug: string } | null;
  _count: { pins: number };
}

interface TenantSimple {
  id: string;
  name: string;
  slug: string;
}

interface PinsClientProps {
  initialBatches: PinBatchItem[];
  totalPins: number;
  pinUsages: number;
  totalPlatformRevenue?: number;
  tenants: TenantSimple[];
}

export function PinsClient({
  initialBatches,
  totalPins,
  pinUsages,
  totalPlatformRevenue = 0,
}: PinsClientProps) {
  const { formatMoney, localization } = useLanguage();
  const [batches] = useState<PinBatchItem[]>(initialBatches);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [exportError, setExportError] = useState('');

  // Export PIN Batch CSV
  const handleExportBatchCSV = async (batch: PinBatchItem) => {
    setExportingId(batch.id);
    setExportError('');
    try {
      const res = await fetch(`/api/admin/pins/export?batchId=${encodeURIComponent(batch.id)}`);
      if (!res.ok) {
        setExportError('Failed to fetch batch serials for export.');
        return;
      }
      const data = await res.json();
      const pins = data.pins || [];

      const headers = [
        'Serial Number',
        'PIN Code',
        `Price (${localization.currencyCode})`,
        'Max Uses',
        'School Name',
        'Created At',
      ];
      const rows = pins.map((p: { serialNumber: string; pinCode: string; pricePaid?: number }) => [
        `"${p.serialNumber}"`,
        `"${p.pinCode}"`,
        p.pricePaid || batch.pricePerPin,
        batch.maxUsesPerPin,
        `"${batch.tenant?.name || 'Global'}"`,
        `"${new Date(batch.createdAt).toLocaleString()}"`,
      ]);

      const csvContent = [headers.join(','), ...rows.map((r: (string | number)[]) => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `${batch.batchNumber || batch.id}_serials.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      setExportError('Error exporting PIN batch CSV.');
    } finally {
      setExportingId(null);
    }
  };

  const metrics = [
    {
      label: 'Total PIN batches',
      value: batches.length.toLocaleString(),
      detail: 'Bulk batches ordered by schools',
      icon: <Layers size={15} aria-hidden="true" />,
    },
    {
      label: 'Total individual serials',
      value: totalPins.toLocaleString(),
      detail: 'Batch & online scratch card PINs',
      icon: <KeyRound size={15} aria-hidden="true" />,
    },
    {
      label: 'Validated usages',
      value: pinUsages.toLocaleString(),
      detail: 'Result-checking attempts recorded',
      icon: <CheckCircle2 size={15} aria-hidden="true" />,
    },
    {
      label: 'Platform PIN revenue',
      value: formatMoney(totalPlatformRevenue, 2),
      detail: 'Platform fee retained from PIN sales',
      icon: <Wallet size={15} aria-hidden="true" />,
      highlight: true,
    },
  ];

  return (
    <div data-ui="accent-ladder" className="space-y-7">
      {/* Header */}
      <header className="flex flex-col justify-between gap-4 pb-5 border-b adm-divider sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] adm-text-muted">
            Result PIN operations
          </p>
          <h1 className="mt-1.5 text-[27px] font-semibold leading-tight tracking-[-0.03em] adm-text-primary sm:text-[30px]">
            Scratch Card PINs
          </h1>
          <p className="mt-1.5 max-w-2xl text-[14px] leading-6 adm-text-secondary">
            Track bulk PIN batch orders, individual serial issuance, result-checking usages, and platform fee earnings across all schools.
          </p>
        </div>

        <div
          title="Schools purchase PIN batches or enable online student PIN checkout from their own Result PIN dashboard."
          className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-lg border adm-divider adm-surface px-3.5 py-1.5 text-[12px] font-medium adm-text-secondary"
        >
          <Info size={14} className="adm-text-muted shrink-0" aria-hidden="true" />
          <span>Self-service school purchases</span>
        </div>
      </header>

      {exportError && (
        <div role="alert" className="adm-status-error rounded-lg border border-rose-500/30 px-4 py-3 text-[13px]">
          {exportError}
        </div>
      )}

      {/* Unified Achromatic Ledger KPI Strip */}
      <section
        aria-label="Scratch card PIN metrics"
        className="adm-card grid grid-cols-1 divide-y sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x rounded-xl border overflow-hidden"
        style={{ borderColor: 'var(--adm-card-border)' }}
      >
        {metrics.map((metric) => (
          <article
            key={metric.label}
            className={`flex items-start justify-between gap-3 p-5 sm:px-6 ${metric.highlight ? 'adm-surface' : ''}`}
            style={{ borderColor: 'var(--adm-divider)' }}
          >
            <div className="min-w-0">
              <p className="text-[12px] font-medium adm-text-secondary">{metric.label}</p>
              <p
                className={`mt-2.5 text-[26px] font-semibold leading-none tracking-[-0.03em] tabular-nums ${
                  metric.highlight ? 'adm-text-accent' : 'adm-text-primary'
                }`}
              >
                {metric.value}
              </p>
              <p className="mt-2 text-[11px] adm-text-muted">{metric.detail}</p>
            </div>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border adm-divider adm-surface adm-text-muted">
              {metric.icon}
            </span>
          </article>
        ))}
      </section>

      {/* PIN Batches Table */}
      <section className="adm-card min-w-0 overflow-hidden rounded-xl border">
        <div className="flex flex-col gap-1 border-b adm-divider px-5 py-4 sm:px-6">
          <h2 className="text-[15px] font-semibold adm-text-primary">Recent bulk PIN batches</h2>
          <p className="text-[12px] leading-5 adm-text-secondary">
            Printed or downloadable batch orders generated by school administrators for result-checker authentication.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead>
              <tr className="border-b adm-divider text-[11px] font-medium uppercase tracking-wider adm-text-muted">
                <th scope="col" className="px-5 py-3 font-medium sm:px-6">Batch reference</th>
                <th scope="col" className="px-4 py-3 font-medium">School tenant</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">PIN count</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Price / PIN</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Platform fee</th>
                <th scope="col" className="px-4 py-3 font-medium">Created</th>
                <th scope="col" className="px-5 py-3 text-right font-medium sm:px-6">Actions</th>
              </tr>
            </thead>
            <tbody>
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <p className="text-[13px] font-medium adm-text-primary">
                      No bulk PIN batches ordered yet.
                    </p>
                    <p className="mx-auto mt-1 max-w-lg text-[12px] leading-5 adm-text-muted">
                      Schools order bulk PIN stock directly from their own Result PIN dashboard. Individual online PIN purchases are already counted in Total Individual Serials and Platform PIN Revenue above.
                    </p>
                  </td>
                </tr>
              ) : (
                batches.map((batch) => (
                  <tr key={batch.id} className="border-b adm-divider last:border-b-0 adm-surface-hover transition-colors">
                    <td className="px-5 py-3.5 font-mono text-[12px] font-semibold adm-text-primary sm:px-6">
                      {batch.batchNumber || batch.id}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="block font-medium adm-text-primary">{batch.tenant?.name || 'Global'}</span>
                      {batch.tenant?.slug && (
                        <span className="block text-[11px] adm-text-muted">/{batch.tenant.slug}</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right font-medium tabular-nums adm-text-primary">
                      {(batch._count?.pins || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums adm-text-secondary">
                      {formatMoney(Number(batch.pricePerPin || 0), 2)}
                    </td>
                    <td className="px-4 py-3.5 text-right font-medium tabular-nums adm-text-accent">
                      {formatMoney(Number(batch.platformFeeTotal || 0), 2)}
                    </td>
                    <td className="px-4 py-3.5 text-[12px] tabular-nums adm-text-muted">
                      {new Date(batch.createdAt).toLocaleDateString(localization.locale, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-5 py-3.5 text-right sm:px-6">
                      <button
                        type="button"
                        onClick={() => handleExportBatchCSV(batch)}
                        disabled={exportingId === batch.id}
                        className="inline-flex items-center gap-1.5 rounded-md border adm-divider adm-surface px-2.5 py-1.5 text-[12px] font-medium adm-text-secondary transition-colors adm-surface-hover disabled:opacity-50 cursor-pointer"
                      >
                        <Download size={13} aria-hidden="true" />
                        {exportingId === batch.id ? 'Exporting…' : 'Export CSV'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
