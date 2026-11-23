'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Building2, CreditCard, ExternalLink, ShieldCheck, UsersRound, Wallet } from 'lucide-react';
import { PlatformFinancialOverview } from '@/lib/super-admin';
import { useLanguage } from '@/components/language-provider';

interface RecentTenantItem {
  id: string;
  name: string;
  slug: string;
  status: string;
  planName: string;
  studentCount: number;
  staffCount: number;
  createdAt: string;
}

interface OverviewClientProps {
  platformName?: string;
  financials: PlatformFinancialOverview;
  tenantCount: number;
  studentCount: number;
  staffCount: number;
  recentTenants: RecentTenantItem[];
  healthAlerts?: Array<{
    id: string;
    tenantName: string;
    slug: string;
    type: 'capacity' | 'trial' | 'suspended';
    message: string;
  }>;
  growthSeries?: Array<{ label: string; schools: number }>;
  impersonationLogs: Array<{
    id: string;
    reason: string;
    startedAt: string;
    endedAt: string | null;
    superAdmin: { name: string; email: string };
    tenant: { name: string; slug: string };
  }>;
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

export function OverviewClient({
  platformName = 'School Platform',
  financials,
  tenantCount,
  studentCount,
  staffCount,
  recentTenants,
  healthAlerts = [],
  growthSeries = [],
  impersonationLogs,
}: OverviewClientProps) {
  const { formatMoney, t } = useLanguage();
  const [logs, setLogs] = useState(impersonationLogs);
  const [endingLogId, setEndingLogId] = useState<string | null>(null);
  const fmtCurrency = (amount: number) => formatMoney(amount, 2);

  const handleEndSession = async (logId: string) => {
    setEndingLogId(logId);
    try {
      const res = await fetch('/api/admin/impersonate/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId }),
      });
      if (res.ok) {
        setLogs((prev) =>
          prev.map((item) => (item.id === logId ? { ...item, endedAt: new Date().toISOString() } : item))
        );
      }
    } finally {
      setEndingLogId(null);
    }
  };
  const { platformRevenue } = financials;

  const keyCounts = [
    { label: t('overview.schoolAccounts', 'School accounts'), value: tenantCount, detail: t('overview.registeredTenants', 'Registered tenants'), icon: <Building2 size={15} aria-hidden="true" /> },
    { label: t('overview.students', 'Students'), value: studentCount, detail: t('overview.enrolledAcross', 'Enrolled across all schools'), icon: <UsersRound size={15} aria-hidden="true" /> },
    { label: t('overview.staff', 'Teachers & staff'), value: staffCount, detail: t('overview.activeStaff', 'Active staff accounts'), icon: <UsersRound size={15} aria-hidden="true" /> },
  ];

  return (
    <div data-ui="accent-ladder" className="space-y-7">
      <header className="flex flex-col justify-between gap-4 pb-5 border-b adm-divider sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] adm-text-muted">{platformName}</p>
          <h1 className="mt-1.5 text-[27px] font-semibold leading-tight tracking-[-0.03em] adm-text-primary sm:text-[30px]">
            {t('overview.title', 'Platform overview')}
          </h1>
          <p className="mt-1.5 max-w-2xl text-[14px] leading-6 adm-text-secondary">
            {t('overview.subtitle', 'Executive pulse across school registrations, student enrollments, platform revenue, and administrator activity.')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/admin/finance"
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border adm-divider adm-surface px-4 text-[13px] font-medium adm-text-secondary transition-colors adm-surface-hover"
          >
            <Wallet size={15} aria-hidden="true" /> {t('admin.finance', 'Platform Finance')} <ArrowRight size={14} aria-hidden="true" />
          </Link>
          <Link
            href="/admin/tenants"
            className="adm-btn-primary inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg px-4 text-[13px] font-semibold"
          >
            {t('overview.manageSchools', 'Manage schools')} <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </header>

      {/* Top Core Metrics — Unified Hairline Ledger Strip */}
      <section
        aria-label="Key platform totals"
        className="adm-card grid grid-cols-1 divide-y sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x rounded-xl border overflow-hidden"
        style={{ borderColor: 'var(--adm-card-border)' }}
      >
        {keyCounts.map((item) => (
          <article
            key={item.label}
            className="flex items-start justify-between gap-3 p-5 sm:px-6"
            style={{ borderColor: 'var(--adm-divider)' }}
          >
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium uppercase tracking-wider adm-text-muted">{item.label}</p>
              <p className="mt-2 text-[26px] font-semibold leading-none tabular-nums adm-text-primary">
                {item.value.toLocaleString('en-NG')}
              </p>
              <p className="mt-2 text-[11px] adm-text-muted">{item.detail}</p>
            </div>
            <span className="adm-text-muted mt-0.5">{item.icon}</span>
          </article>
        ))}

        {/* Financial Snapshot Cell linking to Finance */}
        <Link
          href="/admin/finance"
          className="adm-surface-hover group flex items-start justify-between gap-3 p-5 transition-colors sm:px-6"
          style={{ borderColor: 'var(--adm-divider)' }}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-medium uppercase tracking-wider adm-text-muted">{t('overview.revenue', 'Platform revenue')}</p>
              <ArrowRight size={14} className="adm-text-accent transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </div>
            <p className="mt-2 text-[24px] font-semibold leading-none tabular-nums adm-text-accent">
              {fmtCurrency(platformRevenue.totalPlatformRevenue)}
            </p>
            <p className="mt-2 text-[11px] adm-text-muted">{t('overview.subsAndPins', 'Subscriptions + PIN fees')}</p>
          </div>
          <span className="adm-text-accent mt-0.5"><CreditCard size={15} aria-hidden="true" /></span>
        </Link>
      </section>

      {/* Revenue Composition & Platform Pulse Telemetry */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="adm-card rounded-xl border p-5 sm:p-6 lg:col-span-7 flex flex-col justify-between gap-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] adm-text-muted">
                Revenue mix
              </p>
              <h2 className="mt-1 text-[16px] font-semibold adm-text-primary">
                Subscriptions vs. Result PIN fees
              </h2>
            </div>
            <Link
              href="/admin/finance"
              className="inline-flex items-center gap-1.5 rounded-lg border adm-divider adm-surface adm-surface-hover px-3 py-1.5 text-[12px] font-medium adm-text-secondary transition-colors"
            >
              Ledger <ArrowRight size={13} aria-hidden="true" />
            </Link>
          </div>

          {(() => {
            const total = Math.max(platformRevenue.totalPlatformRevenue, 1);
            const subPct = Math.round((platformRevenue.subscriptionRevenue / total) * 100);
            const pinPct = platformRevenue.totalPlatformRevenue > 0 ? 100 - subPct : 0;
            return (
              <div className="space-y-4">
                <div className="h-2.5 w-full overflow-hidden rounded-full adm-surface flex">
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      width: `${platformRevenue.totalPlatformRevenue > 0 ? Math.max(subPct, 2) : 0}%`,
                      backgroundColor: 'var(--adm-accent)',
                    }}
                  />
                  <div
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{
                      width: `${platformRevenue.totalPlatformRevenue > 0 ? Math.max(pinPct, 2) : 0}%`,
                    }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div className="rounded-lg border adm-divider adm-surface px-4 py-3">
                    <div className="flex items-center justify-between text-[11px] adm-text-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--adm-accent)' }} />
                        Annual Subscriptions
                      </span>
                      <span className="font-mono">{platformRevenue.totalPlatformRevenue > 0 ? `${subPct}%` : '0%'}</span>
                    </div>
                    <p className="mt-1.5 text-[18px] font-semibold tabular-nums adm-text-primary">
                      {fmtCurrency(platformRevenue.subscriptionRevenue)}
                    </p>
                  </div>
                  <div className="rounded-lg border adm-divider adm-surface px-4 py-3">
                    <div className="flex items-center justify-between text-[11px] adm-text-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        PIN Fee Share
                      </span>
                      <span className="font-mono">{platformRevenue.totalPlatformRevenue > 0 ? `${pinPct}%` : '0%'}</span>
                    </div>
                    <p className="mt-1.5 text-[18px] font-semibold tabular-nums adm-text-primary">
                      {fmtCurrency(platformRevenue.pinRevenue)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        <div className="adm-card rounded-xl border p-5 sm:p-6 lg:col-span-5 flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] adm-text-muted">
                Fleet health
              </p>
              <h2 className="mt-1 text-[16px] font-semibold adm-text-primary">
                Tenant status snapshot
              </h2>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border adm-divider adm-surface px-2.5 py-0.5 text-[11px] font-medium adm-text-secondary">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live
            </span>
          </div>

          {/* Real 6-Month Cumulative School Growth SVG Curve */}
          {growthSeries.length > 1 && (() => {
            const maxVal = Math.max(1, ...growthSeries.map((p) => p.schools));
            const width = 320;
            const height = 72;
            const padX = 10;
            const padY = 8;
            const coords = growthSeries.map((pt, idx) => {
              const x = padX + (idx / (growthSeries.length - 1)) * (width - padX * 2);
              const y = height - padY - (pt.schools / maxVal) * (height - padY * 2);
              return { x, y, ...pt };
            });
            const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
            const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${height} L ${coords[0].x.toFixed(1)} ${height} Z`;
            return (
              <div className="rounded-lg border adm-divider adm-surface px-3 pt-3 pb-2">
                <div className="flex items-center justify-between text-[10.5px] adm-text-muted mb-1">
                  <span>6-month school growth</span>
                  <span className="font-mono font-semibold adm-text-primary">{tenantCount} total</span>
                </div>
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[64px] overflow-visible" role="img" aria-label="6-month school growth trend">
                  <defs>
                    <linearGradient id="admGrowthFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--adm-accent)" stopOpacity="0.22" />
                      <stop offset="100%" stopColor="var(--adm-accent)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={areaPath} fill="url(#admGrowthFill)" />
                  <path d={linePath} fill="none" stroke="var(--adm-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  {coords.map((c) => (
                    <circle key={c.label} cx={c.x} cy={c.y} r="3" fill="var(--adm-card-bg)" stroke="var(--adm-accent)" strokeWidth="1.75" />
                  ))}
                </svg>
                <div className="mt-1 flex items-center justify-between font-mono text-[9.5px] adm-text-faint">
                  {growthSeries.map((pt) => (
                    <span key={pt.label}>{pt.label}</span>
                  ))}
                </div>
              </div>
            );
          })()}

          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-lg border adm-divider adm-surface p-3">
              <p className="text-[10.5px] font-medium adm-text-muted">Avg. students</p>
              <p className="mt-1 text-[19px] font-semibold tabular-nums adm-text-primary">
                {tenantCount > 0 ? Math.round(studentCount / tenantCount).toLocaleString() : '0'}
              </p>
              <p className="text-[10px] adm-text-faint">per school</p>
            </div>
            <div className="rounded-lg border adm-divider adm-surface p-3">
              <p className="text-[10.5px] font-medium adm-text-muted">Staff ratio</p>
              <p className="mt-1 text-[19px] font-semibold tabular-nums adm-text-primary">
                {staffCount > 0 ? `${Math.round(studentCount / staffCount)}:1` : '—'}
              </p>
              <p className="text-[10px] adm-text-faint">student/staff</p>
            </div>
            <div className="rounded-lg border adm-divider adm-surface p-3">
              <p className="text-[10.5px] font-medium adm-text-muted">Alerts</p>
              <p className={`mt-1 text-[19px] font-semibold tabular-nums ${healthAlerts.length > 0 ? 'text-amber-500' : 'adm-text-primary'}`}>
                {healthAlerts.length}
              </p>
              <p className="text-[10px] adm-text-faint">{healthAlerts.length === 0 ? 'all healthy' : 'needs review'}</p>
            </div>
          </div>

          <div className="flex items-center justify-between border-t adm-divider pt-3 text-[12px]">
            <span className="adm-text-muted">Quick jump to school directory</span>
            <Link href="/admin/tenants" className="font-medium adm-text-primary hover:underline inline-flex items-center gap-1">
              Manage schools <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </section>

      {/* Two Column Grid */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)]">
        {/* Left Column: Registered Schools Overview */}
        <div className="space-y-5">
          <section className="adm-card min-w-0 overflow-hidden rounded-xl border">
            <div className="flex items-center justify-between border-b adm-divider px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-[15px] font-semibold adm-text-primary">{t('overview.registeredSchools', 'Registered schools')}</h2>
                <p className="mt-0.5 text-[12px] adm-text-secondary">{t('overview.recentSchoolsDesc', 'Recently registered school accounts.')}</p>
              </div>
              <Link
                href="/admin/tenants"
                className="inline-flex items-center gap-1 text-[12px] font-medium adm-text-accent hover:adm-text-primary"
              >
                {t('overview.viewAll', 'View all')} ({tenantCount}) <ArrowRight size={13} aria-hidden="true" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] text-left text-[13px]">
                <thead>
                  <tr className="border-b adm-divider text-[11px] font-medium adm-text-muted">
                    <th scope="col" className="px-5 py-3 font-medium sm:px-6">School</th>
                    <th scope="col" className="px-4 py-3 font-medium">Plan</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Students</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Staff</th>
                    <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTenants.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-[12px] adm-text-muted">
                        No registered schools found.
                      </td>
                    </tr>
                  ) : (
                    recentTenants.map((tenant) => (
                      <tr key={tenant.id} className="border-b adm-divider last:border-b-0 adm-surface-hover">
                        <td className="px-5 py-3.5 sm:px-6">
                          <div className="flex items-center gap-2">
                            <Link href={`/admin/tenants`} className="font-medium adm-text-primary hover:adm-text-accent">
                              {tenant.name}
                            </Link>
                            <a
                              href={`/${tenant.slug}`}
                              target="_blank"
                              rel="noreferrer"
                              title={`Open /${tenant.slug}`}
                              className="adm-text-muted hover:adm-text-primary transition-colors"
                            >
                              <ExternalLink size={12} />
                            </a>
                          </div>
                          <span className="mt-0.5 block text-[11px] font-mono adm-text-muted">/{tenant.slug}</span>
                        </td>
                        <td className="px-4 py-3.5 adm-text-primary font-medium">{tenant.planName}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums adm-text-primary">{tenant.studentCount.toLocaleString('en-NG')}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums adm-text-primary">{tenant.staffCount.toLocaleString('en-NG')}</td>
                        <td className="px-4 py-3.5"><StatusLabel status={tenant.status} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Tenant Health & Usage Alerts */}
          {healthAlerts.length > 0 && (
            <section className="adm-card overflow-hidden rounded-xl border">
              <div className="flex items-center justify-between border-b adm-divider px-5 py-3.5 sm:px-6">
                <div>
                  <h2 className="text-[15px] font-semibold adm-text-primary">Tenant health &amp; alerts</h2>
                  <p className="mt-0.5 text-[12px] adm-text-secondary">
                    Schools near plan limits, expiring trials, or suspended accounts.
                  </p>
                </div>
                <Link
                  href="/admin/tenants"
                  className="inline-flex items-center gap-1 text-[12px] font-medium adm-text-accent hover:adm-text-primary"
                >
                  Review <ArrowRight size={13} aria-hidden="true" />
                </Link>
              </div>
              <div className="divide-y adm-divider">
                {healthAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="px-5 py-3 sm:px-6 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium adm-text-primary truncate">
                        {alert.tenantName}{' '}
                        <span className="font-mono text-[11px] adm-text-muted">/{alert.slug}</span>
                      </p>
                      <p className="text-[12px] adm-text-secondary mt-0.5">{alert.message}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${
                        alert.type === 'suspended'
                          ? 'adm-status-error'
                          : 'adm-status-trial'
                      }`}
                    >
                      {alert.type}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Platform Finance Quick Callout Banner */}
          <section className="adm-card flex flex-col justify-between gap-4 rounded-xl border p-5 sm:flex-row sm:items-center sm:px-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider adm-text-accent">Financial Operations</p>
              <h3 className="mt-1 text-[15px] font-semibold adm-text-primary">School subscriptions & result PIN payouts</h3>
              <p className="mt-1 max-w-xl text-[12px] leading-5 adm-text-secondary">
                Track locked annual contract ARR ({fmtCurrency(platformRevenue.subscriptionRevenue)}), PIN revenue ({fmtCurrency(platformRevenue.pinRevenue)}), and reconcile outstanding payment transfers.
              </p>
            </div>
            <Link
              href="/admin/finance"
              className="adm-btn-primary inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg px-4 text-[12px] font-semibold"
            >
              Open Finance <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </section>
        </div>

        {/* Right Column: Admin Activity & Impersonation Sessions */}
        <section className="adm-card overflow-hidden rounded-xl border">
          <div className="flex items-start justify-between gap-3 border-b adm-divider px-5 py-4">
            <div>
              <h2 className="flex items-center gap-2 text-[15px] font-semibold adm-text-primary">
                <ShieldCheck size={17} className="adm-text-accent" aria-hidden="true" /> {t('overview.adminActivity', 'Admin activity')}
              </h2>
              <p className="mt-1 text-[12px] leading-5 adm-text-secondary">{t('overview.recentSessions', 'Recent tenant access sessions.')}</p>
            </div>
            <Link
              href="/admin/audit-logs"
              className="inline-flex min-h-8 shrink-0 items-center gap-1 text-[12px] font-medium adm-text-accent hover:adm-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17834b]"
            >
              {t('overview.viewLogs', 'View logs')} <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
          <div className="max-h-[460px] divide-y adm-divider overflow-y-auto">
            {logs.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-[13px] font-medium adm-text-primary">No admin activity recorded yet.</p>
                <p className="mt-1 text-[12px] adm-text-muted">Tenant access sessions will be listed here.</p>
              </div>
            ) : (
              logs.map((log) => (
                <article key={log.id} className="space-y-2 border-b adm-divider px-5 py-4 last:border-b-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium adm-text-primary">{log.tenant.name}</p>
                      <p className="mt-0.5 truncate text-[11px] adm-text-muted">Accessed by {log.superAdmin.name}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${log.endedAt ? 'adm-status-neutral' : 'adm-status-active'}`}>
                        {log.endedAt ? 'Ended' : 'Active'}
                      </span>
                      {!log.endedAt && (
                        <button
                          type="button"
                          onClick={() => void handleEndSession(log.id)}
                          disabled={endingLogId === log.id}
                          className="rounded-md border adm-divider adm-surface adm-surface-hover px-2 py-0.5 text-[10px] font-semibold adm-text-secondary hover:text-rose-500 cursor-pointer disabled:opacity-50"
                        >
                          {endingLogId === log.id ? 'Ending…' : 'End'}
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-[12px] leading-5 adm-text-secondary">{log.reason}</p>
                  <time dateTime={log.startedAt} className="block text-[11px] adm-text-faint">
                    {new Date(log.startedAt).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}
                  </time>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
