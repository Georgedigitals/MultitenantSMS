'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface FeatureItem {
 key: string;
 name: string;
 description: string | null;
 enabled: boolean;
 isOverride: boolean;
 enabledByDefault: boolean;
}

interface PlanItem {
 id: string;
 name: string;
}

interface DomainItem {
 id: string;
 domain: string;
 verifiedAt: string | null;
}

interface TenantDetailClientProps {
 tenant: {
 id: string;
 name: string;
 slug: string;
 status: string;
 planId: string;
 planName: string;
 };
 plans: PlanItem[];
 initialFeatures: FeatureItem[];
 initialDomains: DomainItem[];
}

export default function TenantDetailClient({
 tenant,
 plans,
 initialFeatures,
 initialDomains,
}: TenantDetailClientProps) {
 const router = useRouter();
 const [currentPlanId, setCurrentPlanId] = useState(tenant.planId);
 const [features, setFeatures] = useState<FeatureItem[]>(initialFeatures);
 const [loading, setLoading] = useState(false);
 const [message, setMessage] = useState<string | null>(null);
 const [domains, setDomains] = useState<DomainItem[]>(initialDomains);
 const [domainInput, setDomainInput] = useState('');
 const [domainBusy, setDomainBusy] = useState(false);
 const [domainError, setDomainError] = useState<string | null>(null);
 const [verificationRecord, setVerificationRecord] = useState<{ name: string; value: string } | null>(null);

 const handleAddDomain = async (event: React.FormEvent<HTMLFormElement>) => {
 event.preventDefault();
 setDomainBusy(true);
 setDomainError(null);
 setVerificationRecord(null);
 try {
  const response = await fetch('/api/admin/tenants/domains', {
   method: 'POST',
   headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({ tenantId: tenant.id, domain: domainInput }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not add domain.');
  setDomains((current) => [{ ...data.alias }, ...current]);
  setVerificationRecord(data.dnsVerification);
  setDomainInput('');
 } catch (error: any) {
  setDomainError(error.message || 'Could not add domain.');
 } finally {
  setDomainBusy(false);
 }
 };

 const handleVerifyDomain = async (aliasId: string) => {
 setDomainBusy(true);
 setDomainError(null);
 try {
  const response = await fetch('/api/admin/tenants/domains/verify', {
   method: 'POST',
   headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({ aliasId }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Domain is not verified yet.');
  setDomains((current) => current.map((item) => item.id === aliasId
   ? { ...item, verifiedAt: new Date().toISOString() }
   : item));
 } catch (error: any) {
  setDomainError(error.message || 'Domain is not verified yet.');
 } finally {
  setDomainBusy(false);
 }
 };

 const handleRemoveDomain = async (aliasId: string) => {
 if (!window.confirm('Remove this domain from the tenant? Requests for it will stop resolving to this school.')) return;
 setDomainBusy(true);
 setDomainError(null);
 try {
  const response = await fetch(`/api/admin/tenants/domains?id=${encodeURIComponent(aliasId)}`, { method: 'DELETE' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not remove domain.');
  setDomains((current) => current.filter((item) => item.id !== aliasId));
  setVerificationRecord(null);
 } catch (error: any) {
  setDomainError(error.message || 'Could not remove domain.');
 } finally {
  setDomainBusy(false);
 }
 };

 const [showDeleteModal, setShowDeleteModal] = useState(false);
 const [deleteConfirmSlug, setDeleteConfirmSlug] = useState('');
 const [isDeleting, setIsDeleting] = useState(false);
 const [deleteError, setDeleteError] = useState<string | null>(null);

 const handleHardDeleteTenant = async () => {
 if (deleteConfirmSlug.trim() !== tenant.slug) {
 setDeleteError(`Type exact slug "${tenant.slug}" to confirm deletion.`);
 return;
 }

 try {
 setIsDeleting(true);
 setDeleteError(null);
 const res = await fetch(`/api/admin/tenants/${tenant.id}`, {
 method: 'DELETE',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ confirmSlug: deleteConfirmSlug.trim() }),
 });

 const data = await res.json();
 if (!res.ok) {
 throw new Error(data.error || 'Failed to purge tenant');
 }

 alert(`Tenant "${tenant.name}" (${tenant.slug}) has been permanently purged.`);
 router.push('/admin/tenants');
 } catch (err: any) {
 setDeleteError(err.message || 'Error purging tenant');
 } finally {
 setIsDeleting(false);
 }
 };

 const handlePlanChange = async (newPlanId: string) => {
 try {
 setLoading(true);
 setMessage(null);
 const res = await fetch(`/api/admin/tenants/${tenant.id}/features`, {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ action: 'update_plan', planId: newPlanId }),
 });

 if (!res.ok) {
 const errData = await res.json();
 throw new Error(errData.error || 'Failed to update plan');
 }

 const data = await res.json();
 setCurrentPlanId(newPlanId);
 setFeatures(data.features);
 setMessage('Subscription plan updated successfully!');
 } catch (err: any) {
 alert(err.message || 'Error updating plan');
 } finally {
 setLoading(false);
 }
 };

 const handleToggleOverride = async (featureKey: string, currentEnabled: boolean) => {
 const reason = window.prompt(`Why are you changing ${featureKey} for this school?`);
 if (!reason?.trim()) return;
 const paymentReference = window.prompt('Optional payment/reference ID (leave blank if none):') || '';
 try {
 setLoading(true);
 setMessage(null);
 const res = await fetch(`/api/admin/tenants/${tenant.id}/features`, {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 action: 'set_override',
 featureKey,
 enabled: !currentEnabled,
   reason: reason.trim(),
   paymentReference: paymentReference.trim(),
 }),
 });

 if (!res.ok) {
 const errData = await res.json();
 throw new Error(errData.error || 'Failed to toggle override');
 }

 const data = await res.json();
 setFeatures(data.features);
 setMessage(`Feature '${featureKey}' override updated and logged.`);
 } catch (err: any) {
 alert(err.message || 'Error updating feature override');
 } finally {
 setLoading(false);
 }
 };

 const handleRemoveOverride = async (featureKey: string) => {
 try {
 setLoading(true);
 setMessage(null);
 const res = await fetch(`/api/admin/tenants/${tenant.id}/features`, {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 action: 'remove_override',
 featureKey,
 }),
 });

 if (!res.ok) {
 const errData = await res.json();
 throw new Error(errData.error || 'Failed to remove override');
 }

 const data = await res.json();
 setFeatures(data.features);
 setMessage(`Reverted '${featureKey}' to plan default.`);
 } catch (err: any) {
 alert(err.message || 'Error removing feature override');
 } finally {
 setLoading(false);
 }
 };

 return (
 <div className="space-y-8 adm-text-primary">
 {/* Header */}
 <div className="flex items-center justify-between border-b adm-divider pb-5">
 <div>
 <div className="flex items-center space-x-3 mb-1">
 <Link
 href="/admin"
 className="text-xs font-semibold text-blue-400 hover:underline font-mono"
 >
 &larr; Back to Control Plane
 </Link>
 </div>
 <h1 className="text-2xl font-bold tracking-tight adm-text-primary">
 {tenant.name} <span className="adm-text-muted text-lg font-normal">({tenant.slug})</span>
 </h1>
 <p className="adm-text-muted text-sm mt-0.5">
 Super Admin Tenant Feature Overrides & Plan Settings
 </p>
 </div>

 <div className="flex items-center space-x-3">
 <a
 href={`/api/admin/tenants/${tenant.id}/export?format=json`}
 target="_blank"
 rel="noopener noreferrer"
 className="px-3 py-2 rounded-lg text-xs font-semibold adm-surface hover:bg-[var(--adm-surface-hover)] adm-text-secondary border adm-divider transition-colors flex items-center gap-1.5"
 >
 <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 inline-block mr-1"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg> Export Full JSON Archive (NDPR)
 </a>

 <span className="text-xs font-semibold uppercase tracking-wider adm-text-muted font-mono">
 Plan:
 </span>
 <select
 value={currentPlanId}
 onChange={(e) => handlePlanChange(e.target.value)}
 disabled={loading}
 className="adm-surface adm-text-primary text-sm font-semibold rounded-lg px-3 py-2 border adm-divider focus:outline-none focus:border-blue-500"
 >
 {plans.map((p) => (
 <option key={p.id} value={p.id}>
 {p.name}
 </option>
 ))}
 </select>
 </div>
 </div>

 {message && (
 <div className="p-4 rounded-xl bg-emerald-950/70 border border-emerald-800 text-emerald-200 text-sm font-medium">
 {message}
 </div>
 )}

 {/* Custom domain setup */}
 <section className="adm-card border adm-divider rounded-xl overflow-hidden">
  <div className="px-6 py-4 border-b adm-divider">
   <h2 className="font-bold adm-text-primary text-base">Custom domains</h2>
   <p className="text-xs adm-text-muted mt-1">Connect a school-owned domain. Publish the TXT verification record before activating it.</p>
  </div>
  <div className="p-6 space-y-5">
   <form onSubmit={handleAddDomain} className="flex flex-col sm:flex-row gap-3">
    <label className="sr-only" htmlFor="tenant-custom-domain">Domain name</label>
    <input id="tenant-custom-domain" type="text" required value={domainInput} onChange={(event) => setDomainInput(event.target.value)} placeholder="school.example.org" className="flex-1 px-3 py-2.5 rounded-lg border adm-divider adm-surface adm-text-primary text-sm" />
    <button type="submit" disabled={domainBusy || !domainInput.trim()} className="px-4 py-2.5 rounded-lg bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold">{domainBusy ? 'Working…' : 'Add domain'}</button>
   </form>
   {domainError && <p role="alert" className="rounded-lg border border-rose-800 bg-rose-950/50 px-4 py-3 text-sm text-rose-200">{domainError}</p>}
   {verificationRecord && <div className="rounded-lg border border-amber-700/70 bg-amber-950/30 p-4 text-sm">
    <p className="font-semibold text-amber-100">Publish this DNS TXT record, then choose Verify.</p>
    <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-[7rem_1fr]">
     <dt className="adm-text-muted">Name</dt><dd className="font-mono break-all adm-text-primary">{verificationRecord.name}</dd>
     <dt className="adm-text-muted">Value</dt><dd className="font-mono break-all adm-text-primary">{verificationRecord.value}</dd>
    </dl>
    <button type="button" onClick={() => navigator.clipboard.writeText(`${verificationRecord.name} TXT ${verificationRecord.value}`)} className="mt-3 rounded-md border border-amber-700 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-900/40">Copy record</button>
   </div>}
   {domains.length === 0 ? <p className="py-4 text-sm adm-text-muted">No custom domains connected.</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b adm-divider text-left text-xs uppercase tracking-wide adm-text-muted"><th className="py-3 pr-4">Domain</th><th className="py-3 pr-4">Status</th><th className="py-3 text-right">Actions</th></tr></thead><tbody className="divide-y adm-divider">{domains.map((item) => <tr key={item.id}><td className="py-3 pr-4 font-mono adm-text-primary">{item.domain}</td><td className="py-3 pr-4">{item.verifiedAt ? <span className="text-emerald-300">Verified</span> : <span className="text-amber-300">Needs verification</span>}</td><td className="py-3 text-right whitespace-nowrap">{!item.verifiedAt && <button type="button" disabled={domainBusy} onClick={() => handleVerifyDomain(item.id)} className="mr-3 font-semibold text-blue-300 hover:text-blue-200 disabled:opacity-50">Verify DNS</button>}<button type="button" disabled={domainBusy} onClick={() => handleRemoveDomain(item.id)} className="font-semibold text-rose-300 hover:text-rose-200 disabled:opacity-50">Remove</button></td></tr>)}</tbody></table></div>}
  </div>
 </section>

 {/* Feature Flags & Overrides Table */}
 <div className="adm-card border adm-divider rounded-xl overflow-hidden shadow-xl">
 <div className="px-6 py-4 border-b adm-divider flex justify-between items-center">
 <div>
 <h2 className="font-bold adm-text-primary text-base">Feature Flags &amp; Overrides</h2>
 <p className="text-xs adm-text-muted mt-0.5">
 A school override takes priority over the plan, so you can grant this module even when the school’s plan does not include it.
 </p>
 </div>
 <span className="text-xs text-blue-400 font-mono">Single Helper Lookup Enforced</span>
 </div>

 <div className="overflow-x-auto">
 <table className="w-full text-left text-sm adm-text-secondary">
 <thead className="bg-slate-950/60 text-xs uppercase tracking-wider adm-text-muted font-mono">
 <tr>
 <th className="px-6 py-3.5">Feature Key</th>
 <th className="px-6 py-3.5">Description</th>
 <th className="px-6 py-3.5">Plan Default</th>
 <th className="px-6 py-3.5">Active Status</th>
 <th className="px-6 py-3.5">Resolution Source</th>
 <th className="px-6 py-3.5 text-right">Actions</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-800">
 {features.map((f) => (
 <tr key={f.key} className="hover:bg-slate-800/40 transition-colors">
 <td className="px-6 py-4 font-mono font-bold text-cyan-400">{f.key}</td>
 <td className="px-6 py-4 text-xs adm-text-muted max-w-xs">{f.description || f.name}</td>
 <td className="px-6 py-4">
 <span
 className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
 f.enabledByDefault
 ? 'adm-surface adm-text-secondary'
 : 'adm-surface adm-text-muted'
 }`}
 >
 {f.enabledByDefault ? 'Enabled' : 'Disabled'}
 </span>
 </td>
 <td className="px-6 py-4">
 <span
 className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
 f.enabled
 ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
 : 'bg-rose-950 text-rose-300 border border-rose-800'
 }`}
 >
 {f.enabled ? 'Active (ON)' : 'Disabled (OFF)'}
 </span>
 </td>
 <td className="px-6 py-4">
 {f.isOverride ? (
 <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950 text-amber-300 border border-amber-800">
 <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 inline-block mr-1"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.381z" clipRule="evenodd" /></svg> Super Admin Override
 </span>
 ) : (
 <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold adm-surface adm-text-muted">
 Plan Default
 </span>
 )}
 </td>
 <td className="px-6 py-4 text-right space-x-2">
 <button
 onClick={() => handleToggleOverride(f.key, f.enabled)}
 disabled={loading}
 className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
 f.enabled
 ? 'bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-700'
 : 'bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 border border-emerald-700'
 }`}
 >
 {f.enabled ? 'Disable' : 'Enable'}
 </button>

 {f.isOverride && (
 <button
 onClick={() => handleRemoveOverride(f.key)}
 disabled={loading}
 className="px-3 py-1.5 rounded-lg text-xs font-semibold adm-surface hover:bg-[var(--adm-surface-hover)] adm-text-secondary border adm-divider transition-colors"
 title="Revert to Plan Default"
 >
 Revert
 </button>
 )}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>

 {/* Danger Zone — Permanent Tenant Purge */}
 <div className="bg-rose-950/40 border border-rose-900/80 rounded-3xl p-6 shadow-2xl backdrop-blur-md mt-10">
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
 <div>
 <div className="flex items-center gap-2 mb-1">
 <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-900 text-rose-200 border border-rose-700">
 <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 inline-block text-amber-400 mr-1"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg> DANGER ZONE
 </span>
 <span className="text-xs text-rose-400 font-mono">Irreversible Action</span>
 </div>
 <h3 className="text-lg font-bold adm-text-primary">Permanently Purge School Tenant</h3>
 <p className="text-xs adm-text-muted max-w-xl mt-1">
 Completely delete this school instance ({tenant.slug}) and erase all associated database records (students, staff, results, fee logs, and user accounts). This action cannot be undone.
 </p>
 </div>
 <button
 onClick={() => setShowDeleteModal(true)}
 className="px-5 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition-all shrink-0 hover:scale-[1.02]"
 >
 <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 inline-block mr-1"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg> Permanently Delete Tenant
 </button>
 </div>
 </div>

 {/* Delete Confirmation Modal */}
 {showDeleteModal && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
 <div className="adm-card border border-rose-900/80 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 relative">
 <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center text-2xl mx-auto">
 <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 inline-block text-amber-400 mr-1"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
 </div>
 <div className="text-center">
 <h3 className="text-xl font-bold adm-text-primary">Permanent Purge Confirmation</h3>
 <p className="text-xs adm-text-muted mt-2 leading-relaxed">
 You are about to permanently delete <strong className="adm-text-primary">{tenant.name}</strong> (<code className="text-rose-400 font-mono">{tenant.slug}</code>). All student profiles, transcripts, staff rosters, and financial records will be destroyed.
 </p>
 </div>

 {deleteError && (
 <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs font-semibold text-center">
 {deleteError}
 </div>
 )}

 <div className="space-y-2">
 <label className="text-[11px] font-mono adm-text-muted uppercase tracking-wider block">
 Type <strong className="text-rose-400">{tenant.slug}</strong> to confirm:
 </label>
 <input
 type="text"
 placeholder={tenant.slug}
 value={deleteConfirmSlug}
 onChange={(e) => setDeleteConfirmSlug(e.target.value)}
 className="w-full px-4 py-3 adm-surface border adm-divider rounded-xl text-sm font-mono adm-text-primary focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
 />
 </div>

 <div className="flex items-center gap-3 pt-2">
 <button
 type="button"
 onClick={() => {
 setShowDeleteModal(false);
 setDeleteConfirmSlug('');
 setDeleteError(null);
 }}
 disabled={isDeleting}
 className="w-1/2 py-3 rounded-xl adm-surface hover:bg-[var(--adm-surface-hover)] adm-text-secondary font-bold text-xs transition"
 >
 Cancel
 </button>
 <button
 type="button"
 onClick={handleHardDeleteTenant}
 disabled={isDeleting || deleteConfirmSlug.trim() !== tenant.slug}
 className="w-1/2 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition flex items-center justify-center gap-2"
 >
 {isDeleting ? (
 <span>Purging...</span>
 ) : (
 <span>Purge All Data <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 inline-block mr-1"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg></span>
 )}
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
}
