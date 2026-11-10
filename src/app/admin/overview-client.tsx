'use client';

import Link from 'next/link';
import { ArrowRight, Building2, CreditCard, ShieldCheck, UsersRound, Wallet } from 'lucide-react';
import { PlatformFinancialOverview } from '@/lib/super-admin';

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
  financials: PlatformFinancialOverview;
  tenantCount: number;
  studentCount: number;
  staffCount: number;
  recentTenants: RecentTenantItem[];
  impersonationLogs: Array<{
    id: string;
    reason: string;
    startedAt: string;
    endedAt: string | null;
    superAdmin: { name: string; email: string };
    tenant: { name: string; slug: string };
  }>;
}

const naira = (amount: number) => `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
  financials,
  tenantCount,
  studentCount,
  staffCount,
  recentTenants,
  impersonationLogs,
}: OverviewClientProps) {
  const { platformRevenue } = financials;

  const keyCounts = [
    { label: 'School accounts', value: tenantCount, detail: 'Registered tenants', icon: <Building2 size={16} aria-hidden="true" /> },
    { label: 'Students', value: studentCount, detail: 'Enrolled across all schools', icon: <UsersRound size={16} aria-hidden="true" /> },
    { label: 'Teachers & staff', value: staffCount, detail: 'Active staff accounts', icon: <UsersRound size={16} aria-hidden="true" /> },
  ];

  return (
    <div data-ui="accent-ladder" className="space-y-7">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] adm-text-accent">BMS platform</p>
          <h1 className="mt-2 text-[27px] font-semibold leading-tight tracking-[-0.035em] adm-text-primary sm:text-[30px]">
            Platform overview
          </h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-6 adm-text-secondary">
            High-level executive pulse across school registrations, total student enrollments, platform revenue, and administrator activity.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/admin/finance"
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md border adm-divider px-4 text-[13px] font-medium adm-text-secondary transition-colors adm-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17834b]"
          >
            <Wallet size={15} aria-hidden="true" /> Platform Finance <ArrowRight size={14} aria-hidden="true" />
          </Link>
          <Link
            href="/admin/tenants"
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-[#17834b] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#126b3d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17834b]"
          >
            Manage schools <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </header>

      {/* Top Core Metrics Grid */}
      <section aria-label="Key platform totals" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {keyCounts.map((item) => (
          <article key={item.label} className="adm-card flex items-center gap-4 rounded-xl border p-5 sm:px-6">
            <span className="adm-text-accent">{item.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] adm-text-secondary">{item.label}</p>
              <p className="mt-1 text-[22px] font-semibold leading-none tabular-nums adm-text-primary">
                {item.value.toLocaleString('en-NG')}
              </p>
              <p className="mt-1.5 text-[11px] adm-text-muted">{item.detail}</p>
            </div>
          </article>
        ))}

        {/* Financial Snapshot Card linking to Finance */}
        <Link
          href="/admin/finance"
          className="adm-card adm-surface-hover group relative flex items-center gap-4 rounded-xl border p-5 transition-all sm:px-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17834b]"
        >
          <span className="adm-text-accent"><CreditCard size={18} aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <p className="text-[12px] adm-text-secondary">Platform revenue total</p>
              <ArrowRight size={14} className="adm-text-accent transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </div>
            <p className="mt-1 text-[22px] font-semibold leading-none tabular-nums adm-text-accent">
              {naira(platformRevenue.totalPlatformRevenue)}
            </p>
            <p className="mt-1.5 text-[11px] adm-text-muted">Subscriptions + PIN fees →</p>
          </div>
        </Link>
      </section>

      {/* Two Column Grid */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)]">
        {/* Left Column: Registered Schools Overview */}
        <div className="space-y-5">
          <section className="adm-card min-w-0 overflow-hidden rounded-xl border">
            <div className="flex items-center justify-between border-b adm-divider px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-[15px] font-semibold adm-text-primary">Registered schools</h2>
                <p className="mt-0.5 text-[12px] adm-text-secondary">Recently registered school accounts.</p>
              </div>
              <Link
                href="/admin/tenants"
                className="inline-flex items-center gap-1 text-[12px] font-medium adm-text-accent hover:adm-text-primary"
              >
                View all ({tenantCount}) <ArrowRight size={13} aria-hidden="true" />
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
                          <Link href={`/admin/tenants`} className="font-medium adm-text-primary hover:adm-text-accent">
                            {tenant.name}
                          </Link>
                          <span className="mt-0.5 block text-[11px] adm-text-muted">/{tenant.slug}</span>
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

          {/* Platform Finance Quick Callout Banner */}
          <section className="adm-card flex flex-col justify-between gap-4 rounded-xl border p-5 sm:flex-row sm:items-center sm:px-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider adm-text-accent">Financial Operations</p>
              <h3 className="mt-1 text-[15px] font-semibold adm-text-primary">School subscriptions & result PIN payouts</h3>
              <p className="mt-1 max-w-xl text-[12px] leading-5 adm-text-secondary">
                Track locked annual contract ARR ({naira(platformRevenue.subscriptionRevenue)}), PIN revenue ({naira(platformRevenue.pinRevenue)}), and reconcile outstanding Paystack transfers.
              </p>
            </div>
            <Link
              href="/admin/finance"
              className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-[#17834b] px-4 text-[12px] font-semibold text-white transition-colors hover:bg-[#126b3d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17834b]"
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
                <ShieldCheck size={17} className="adm-text-accent" aria-hidden="true" /> Admin activity
              </h2>
              <p className="mt-1 text-[12px] leading-5 adm-text-secondary">Recent tenant access sessions.</p>
            </div>
            <Link
              href="/admin/audit-logs"
              className="inline-flex min-h-8 shrink-0 items-center gap-1 text-[12px] font-medium adm-text-accent hover:adm-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17834b]"
            >
              View logs <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
          <div className="max-h-[460px] divide-y divide-[#edf0ed] overflow-y-auto">
            {impersonationLogs.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-[13px] font-medium adm-text-primary">No admin activity recorded yet.</p>
                <p className="mt-1 text-[12px] adm-text-muted">Tenant access sessions will be listed here.</p>
              </div>
            ) : (
              impersonationLogs.map((log) => (
                <article key={log.id} className="space-y-2 border-b adm-divider px-5 py-4 last:border-b-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium adm-text-primary">{log.tenant.name}</p>
                      <p className="mt-0.5 truncate text-[11px] adm-text-muted">Accessed by {log.superAdmin.name}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${log.endedAt ? 'adm-status-neutral' : 'adm-status-active'}`}>
                      {log.endedAt ? 'Ended' : 'Active'}
                    </span>
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
