'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { TenantStatus } from '@prisma/client';
import { getTenantUrl } from '@/lib/tenant-url';

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'eduorg.ng';

interface Plan {
 id: string;
 name: string;
 price: number;
}

interface FeatureOverride {
 featureKey: string;
 enabled: boolean;
}

interface DomainAliasItem {
 id: string;
 domain: string;
 verifiedAt: string | null;
}

interface TenantItem {
 id: string;
 name: string;
 slug: string;
 status: TenantStatus;
 archivedAt?: string | null;
 adminEmail?: string;
 domainAliases?: DomainAliasItem[];
 plan: Plan;
 featureOverrides: FeatureOverride[];
 _count: { students: number; staff: number; sessions: number };
}

interface TenantsClientProps {
 initialTenants: TenantItem[];
 availablePlans: Plan[];
}

export function TenantsClient({ initialTenants, availablePlans }: TenantsClientProps) {
 const [tenants, setTenants] = useState<TenantItem[]>(initialTenants);
 const [activeTab, setActiveTab] = useState<'directory' | 'recycle_bin'>('directory');
 const [search, setSearch] = useState('');
 const [statusFilter, setStatusFilter] = useState<string>('all');
 const [selectedTenantIds, setSelectedTenantIds] = useState<string[]>([]);

 // Domain Modal State
 const [domainModalTenant, setDomainModalTenant] = useState<TenantItem | null>(null);
 const [newCustomDomain, setNewCustomDomain] = useState('');
 const [addingDomain, setAddingDomain] = useState(false);

 async function handleAddDomainAlias(tenantId: string) {
 if (!newCustomDomain.trim()) return;
 try {
 setAddingDomain(true);
 const res = await fetch('/api/admin/tenants/domains', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ tenantId, domain: newCustomDomain.trim() }),
 });

 const data = await res.json();
 if (!res.ok) throw new Error(data.error || 'Failed to add custom domain');

 setTenants((prev) =>
 prev.map((t) =>
 t.id === tenantId
 ? { ...t, domainAliases: [...(t.domainAliases || []), data.alias] }
 : t
 )
 );
 if (domainModalTenant?.id === tenantId) {
 setDomainModalTenant((prev) =>
 prev ? { ...prev, domainAliases: [...(prev.domainAliases || []), data.alias] } : null
 );
 }
 setNewCustomDomain('');
 } catch (err: any) {
 alert(err.message || 'Error adding custom domain');
 } finally {
 setAddingDomain(false);
 }
 }

 async function handleRemoveDomainAlias(tenantId: string, aliasId: string) {
 if (!confirm('Remove this custom domain alias?')) return;
 try {
 const res = await fetch(`/api/admin/tenants/domains?id=${aliasId}`, {
 method: 'DELETE',
 });
 if (!res.ok) throw new Error('Failed to remove domain alias');

 setTenants((prev) =>
 prev.map((t) =>
 t.id === tenantId
 ? { ...t, domainAliases: (t.domainAliases || []).filter((da) => da.id !== aliasId) }
 : t
 )
 );
 if (domainModalTenant?.id === tenantId) {
 setDomainModalTenant((prev) =>
 prev
 ? {
 ...prev,
 domainAliases: (prev.domainAliases || []).filter((da) => da.id !== aliasId),
 }
 : null
 );
 }
 } catch (err: any) {
 alert(err.message || 'Error removing domain alias');
 }
 }

 // Create Tenant Modal State
 const [showCreateModal, setShowCreateModal] = useState(false);
 const [newName, setNewName] = useState('');
 const [newSlug, setNewSlug] = useState('');
 const [newPlanId, setNewPlanId] = useState(availablePlans[0]?.id || 'plan_growth');
 const [creating, setCreating] = useState(false);
 const [createError, setCreateError] = useState('');

 // Import Snapshot Modal State
 const [showImportModal, setShowImportModal] = useState(false);
 const [importJsonText, setImportJsonText] = useState('');
 const [importNameOverride, setImportNameOverride] = useState('');
 const [importSlugOverride, setImportSlugOverride] = useState('');
 const [importPlanId, setImportPlanId] = useState(availablePlans[0]?.id || '');
 const [importing, setImporting] = useState(false);
 const [importError, setImportError] = useState('');

 // Impersonation Modal State
 const [impersonateTarget, setImpersonateTarget] = useState<TenantItem | null>(null);
 const [impersonateReason, setImpersonateReason] = useState('');
 const [impersonating, setImpersonating] = useState(false);
 const [impersonateError, setImpersonateError] = useState('');

 // Permanent Purge Modal State
 const [purgeTarget, setPurgeTarget] = useState<TenantItem | null>(null);
 const [purgeConfirmSlug, setPurgeConfirmSlug] = useState('');
 const [purging, setPurging] = useState(false);
 const [purgeError, setPurgeError] = useState('');

 // Counts
 const activeTenantsCount = tenants.filter((t) => t.status !== 'archived').length;
 const archivedTenantsCount = tenants.filter((t) => t.status === 'archived').length;

 // Filtered List
 const filteredTenants = tenants.filter((tenant) => {
 const isArchived = tenant.status === 'archived';
 if (activeTab === 'directory' && isArchived) return false;
 if (activeTab === 'recycle_bin' && !isArchived) return false;

 if (statusFilter !== 'all' && tenant.status !== statusFilter) return false;

 const term = search.toLowerCase().trim();
 if (!term) return true;

 return (
 tenant.name.toLowerCase().includes(term) ||
 tenant.slug.toLowerCase().includes(term) ||
 tenant.adminEmail?.toLowerCase().includes(term) ||
 tenant.plan?.name.toLowerCase().includes(term)
 );
 });

 // Bulk Status Update
 async function handleBulkStatusChange(newStatus: TenantStatus) {
 if (selectedTenantIds.length === 0) return;
 if (!confirm(`Are you sure you want to change status of ${selectedTenantIds.length} selected schools to ${newStatus}?`)) return;

 try {
 await Promise.all(
 selectedTenantIds.map((id) =>
 fetch('/api/admin/tenants/status', {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ tenantId: id, status: newStatus }),
 })
 )
 );
 setTenants((prev) =>
 prev.map((t) => (selectedTenantIds.includes(t.id) ? { ...t, status: newStatus, archivedAt: newStatus === 'archived' ? new Date().toISOString() : null } : t))
 );
 setSelectedTenantIds([]);
 } catch (err: any) {
 alert('Error updating bulk status');
 }
 }

 // Handle Status Change
 async function handleStatusChange(tenantId: string, newStatus: TenantStatus) {
 if (newStatus === 'archived') {
 if (!confirm('Move this school to the Recycle Bin? Their data will be safely archived and can be restored anytime.')) return;
 }

 try {
 const res = await fetch('/api/admin/tenants/status', {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ tenantId, status: newStatus }),
 });

 if (!res.ok) {
 const errData = await res.json();
 throw new Error(errData.error || 'Failed to update status');
 }

 setTenants((prev) =>
 prev.map((t) => (t.id === tenantId ? { ...t, status: newStatus, archivedAt: newStatus === 'archived' ? new Date().toISOString() : null } : t))
 );
 } catch (err: any) {
 alert(err.message || 'Error updating tenant status');
 }
 }

 // Handle Plan Change
 async function handlePlanChange(tenantId: string, planId: string) {
 try {
 const res = await fetch(`/api/admin/tenants/${tenantId}/features`, {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ action: 'update_plan', planId }),
 });

 if (!res.ok) throw new Error('Failed to update plan');

 const updatedPlan = availablePlans.find((p) => p.id === planId);
 if (updatedPlan) {
 setTenants((prev) => prev.map((t) => (t.id === tenantId ? { ...t, plan: updatedPlan } : t)));
 }
 } catch (err: any) {
 alert(err.message || 'Error updating subscription plan');
 }
 }

 // Handle Export Snapshot
 function handleExportTenantData(tenantId: string, slug: string) {
 window.open(`/api/admin/tenants/${tenantId}/export?format=json`, '_blank');
 }

 // Handle Create School
 async function handleCreateTenant(e: React.FormEvent) {
 e.preventDefault();
 if (!newName || !newSlug || !newPlanId) return;

 setCreating(true);
 setCreateError('');

 try {
 const res = await fetch('/api/admin/tenants', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 name: newName,
 slug: newSlug,
 planId: newPlanId,
 status: 'trial',
 }),
 });

 const data = await res.json();
 if (!res.ok) throw new Error(data.error || 'Failed to create tenant');

 const createdPlan = availablePlans.find((p) => p.id === newPlanId) || { id: newPlanId, name: 'Standard', price: 0 };
 const createdItem: TenantItem = {
 id: data.tenant.id,
 name: data.tenant.name,
 slug: data.tenant.slug,
 status: data.tenant.status,
 plan: createdPlan,
 adminEmail: `admin@${data.tenant.slug}.edu`,
 domainAliases: [],
 featureOverrides: [],
 _count: { students: 0, staff: 1, sessions: 1 },
 };

 setTenants([createdItem, ...tenants]);
 setShowCreateModal(false);
 setNewName('');
 setNewSlug('');
 } catch (err: any) {
 setCreateError(err.message);
 } finally {
 setCreating(false);
 }
 }

 // Handle Import Snapshot JSON
 async function handleImportSnapshot(e: React.FormEvent) {
 e.preventDefault();
 if (!importJsonText.trim()) {
 setImportError('Please paste or upload JSON snapshot data.');
 return;
 }

 try {
 setImporting(true);
 setImportError('');

 let parsedSnapshot: any;
 try {
 parsedSnapshot = JSON.parse(importJsonText);
 } catch (err) {
 throw new Error('Invalid JSON string format. Please verify file content.');
 }

 const res = await fetch('/api/admin/tenants/import', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 snapshot: parsedSnapshot,
 overrideName: importNameOverride,
 overrideSlug: importSlugOverride,
 planId: importPlanId,
 }),
 });

 const data = await res.json();
 if (!res.ok) throw new Error(data.error || 'Failed to import tenant snapshot');

 alert(data.message || 'School snapshot imported successfully!');
 setShowImportModal(false);
 setImportJsonText('');
 window.location.reload();
 } catch (err: any) {
 setImportError(err.message);
 } finally {
 setImporting(false);
 }
 }

 // File Upload Handler for Import Modal
 const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file) return;

 const reader = new FileReader();
 reader.onload = (event) => {
 const content = event.target?.result as string;
 if (content) {
 setImportJsonText(content);
 try {
 const json = JSON.parse(content);
 const schoolObj = json.school || json.tenant || json;
 if (schoolObj?.name) setImportNameOverride(schoolObj.name);
 if (schoolObj?.slug) setImportSlugOverride(schoolObj.slug);
 } catch {}
 }
 };
 reader.readAsText(file);
 };

 // Handle Impersonation
 async function handleStartImpersonation(e: React.FormEvent) {
 e.preventDefault();
 if (!impersonateTarget || !impersonateReason.trim()) return;

 setImpersonating(true);
 setImpersonateError('');

 try {
 const res = await fetch('/api/admin/impersonate/start', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 tenantId: impersonateTarget.id,
 reason: impersonateReason.trim(),
 }),
 });

 const data = await res.json();
 if (!res.ok) throw new Error(data.error || 'Failed to start impersonation');

 window.location.href = data.redirectUrl || data.targetUrl || getTenantUrl(impersonateTarget.slug, '/dashboard');
 } catch (err: any) {
 setImpersonateError(err.message);
 } finally {
 setImpersonating(false);
 }
 }

 // Handle Permanent Hard Delete
 async function handleHardDeleteTenant() {
 if (!purgeTarget) return;
 if (purgeConfirmSlug.trim() !== purgeTarget.slug) {
 setPurgeError(`Type exact slug "${purgeTarget.slug}" to confirm deletion.`);
 return;
 }

 try {
 setPurging(true);
 setPurgeError('');
 const res = await fetch(`/api/admin/tenants/${purgeTarget.id}`, {
 method: 'DELETE',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ confirmSlug: purgeConfirmSlug.trim() }),
 });

 const data = await res.json();
 if (!res.ok) throw new Error(data.error || 'Failed to purge tenant');

 setTenants((prev) => prev.filter((t) => t.id !== purgeTarget.id));
 setPurgeTarget(null);
 setPurgeConfirmSlug('');
 alert(`Tenant "${purgeTarget.name}" (${purgeTarget.slug}) and all associated database records were permanently purged.`);
 } catch (err: any) {
 setPurgeError(err.message || 'Error purging tenant');
 } finally {
 setPurging(false);
 }
 }

 const toggleSelectAll = () => {
 if (selectedTenantIds.length === filteredTenants.length) {
 setSelectedTenantIds([]);
 } else {
 setSelectedTenantIds(filteredTenants.map((t) => t.id));
 }
 };

 const toggleSelectTenant = (id: string) => {
 setSelectedTenantIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
 };

 return (
 <div className="space-y-6 relative">

 {/* Header & Main Controls */}
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 relative z-10">
 <div>
 <div className="flex items-center gap-2 mb-1.5">
 <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-semibold bg-sky-500/10 text-sky-500 border border-sky-500/20 uppercase tracking-widest">
 Schools Registry
 </span>
 </div>
 <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight adm-text-primary">
 Schools &amp; Tenants Directory
 </h1>
 <p className="text-xs adm-text-muted mt-1 max-w-2xl leading-relaxed">
 Onboard new school clients, import/export NDPR data archives, manage subdomains, and launch audited admin impersonations.
 </p>
 </div>

 <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap">
 <button
 onClick={() => setShowImportModal(true)}
 className="px-4 py-2.5 rounded-xl adm-surface border adm-divider adm-text-secondary hover:text-[var(--adm-text-primary)] font-semibold text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
 >
 <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
 <span>Import Snapshot</span>
 </button>

 <button
 onClick={() => setShowCreateModal(true)}
 className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-1.5 cursor-pointer hover:-translate-y-0.5"
 >
 <span>+</span>
 <span>Onboard New School</span>
 </button>
 </div>
 </div>

 {/* Navigation Tabs */}
 <div className="flex items-center justify-between gap-4 border-b adm-divider pb-4 relative z-10">
 <div className="flex items-center space-x-2">
 <button
 onClick={() => { setActiveTab('directory'); setSelectedTenantIds([]); }}
 className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
 activeTab === 'directory'
 ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20'
 : 'adm-surface border adm-divider adm-text-secondary hover:text-[var(--adm-text-primary)]'
 }`}
 >
 <span>Active Directory</span>
 <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
 activeTab === 'directory' ? 'bg-white/20 text-white' : 'adm-badge'
 }`}>{activeTenantsCount}</span>
 </button>

 <button
 onClick={() => { setActiveTab('recycle_bin'); setSelectedTenantIds([]); }}
 className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
 activeTab === 'recycle_bin'
 ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
 : 'adm-surface border adm-divider adm-text-secondary hover:text-[var(--adm-text-primary)]'
 }`}
 >
 <span>Recycle Bin / Archived</span>
 <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
 activeTab === 'recycle_bin' ? 'bg-white/20 text-white' : 'adm-badge'
 }`}>{archivedTenantsCount}</span>
 </button>
 </div>
 </div>

 {/* Filter & Search Toolbar */}
 <div className="adm-card border rounded-2xl p-4 shadow-sm space-y-4 relative z-10">
 <div className="flex flex-col md:flex-row items-center justify-between gap-4">
 <div className="relative w-full md:w-96">
 <input
 type="text"
 placeholder={activeTab === 'recycle_bin' ? 'Search archived schools...' : 'Search school name, slug, or admin email...'}
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 className="adm-input w-full pl-10 pr-4 py-2.5 border rounded-xl text-xs"
 />
 <span className="absolute left-3 top-1/2 -translate-y-1/2 adm-text-muted">
 <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
 </span>
 </div>

 <div className="flex items-center gap-3 w-full md:w-auto justify-end">
 <select
 value={statusFilter}
 onChange={(e) => setStatusFilter(e.target.value)}
 className="adm-input border rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer"
 >
 <option value="all">All Statuses</option>
 <option value="trial">Trial</option>
 <option value="active">Active</option>
 <option value="suspended">Suspended</option>
 <option value="archived">Archived</option>
 </select>

 {selectedTenantIds.length > 0 && (
 <div className="flex items-center gap-2 adm-surface px-3 py-1.5 rounded-xl border adm-divider">
 <span className="text-[11px] font-mono text-amber-500 font-bold">
 {selectedTenantIds.length} Selected
 </span>
 {activeTab === 'directory' ? (
 <button
 onClick={() => handleBulkStatusChange('archived' as TenantStatus)}
 className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20 transition cursor-pointer"
 >
 Archive Selected
 </button>
 ) : (
 <button
 onClick={() => handleBulkStatusChange('active' as TenantStatus)}
 className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20 transition cursor-pointer"
 >
 Restore Selected
 </button>
 )}
 </div>
 )}
 </div>
 </div>
 </div>

 {/* Main Spacious Tenants Table Container */}
 <div className="adm-card border rounded-2xl shadow-sm overflow-hidden relative z-10">
 {filteredTenants.length === 0 ? (
 <div className="p-16 text-center adm-text-muted">
 <div className="w-12 h-12 rounded-full adm-surface border adm-divider flex items-center justify-center mx-auto mb-3">
 <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 adm-text-muted"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" /></svg>
 </div>
 <h3 className="text-sm font-bold adm-text-primary mb-1">No Schools Found</h3>
 <p className="text-xs adm-text-muted">
 {activeTab === 'recycle_bin'
 ? 'The Recycle Bin is empty. No archived schools found.'
 : 'No registered school matches your filter criteria.'}
 </p>
 </div>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full text-left border-collapse">
 <thead>
 <tr className="adm-surface border-b adm-divider">
 <th className="py-3.5 px-4 w-10 text-center">
 <input
 type="checkbox"
 checked={selectedTenantIds.length === filteredTenants.length && filteredTenants.length > 0}
 onChange={toggleSelectAll}
 className="rounded border-slate-400 text-indigo-500 focus:ring-indigo-500 cursor-pointer"
 />
 </th>
 <th className="py-3.5 px-4 text-[10px] font-semibold adm-text-muted uppercase tracking-widest">School Institution</th>
 <th className="py-3.5 px-4 text-[10px] font-semibold adm-text-muted uppercase tracking-widest">Admin Account</th>
 <th className="py-3.5 px-4 text-[10px] font-semibold adm-text-muted uppercase tracking-widest">{activeTab === 'recycle_bin' ? 'Archived Date' : 'Plan Tier'}</th>
 <th className="py-3.5 px-4 text-[10px] font-semibold adm-text-muted uppercase tracking-widest">Status</th>
 <th className="py-3.5 px-4 text-[10px] font-semibold adm-text-muted uppercase tracking-widest">Scale Metrics</th>
 <th className="py-3.5 px-4 text-right text-[10px] font-semibold adm-text-muted uppercase tracking-widest">Actions</th>
 </tr>
 </thead>
 <tbody className="divide-y adm-divider text-xs adm-text-primary">
 {filteredTenants.map((tenant) => (
 <tr key={tenant.id} className="adm-surface-hover transition-colors">
 <td className="py-4 px-4 text-center">
 <input
 type="checkbox"
 checked={selectedTenantIds.includes(tenant.id)}
 onChange={() => toggleSelectTenant(tenant.id)}
 className="rounded adm-surface adm-divider text-blue-600 focus:ring-blue-500"
 />
 </td>

 {/* School Name & Subdomain */}
 <td className="py-4 px-4">
 <div className="font-extrabold adm-text-primary text-sm hover:text-blue-400 transition-colors">
 <Link href={`/admin/tenants/${tenant.id}`}>{tenant.name}</Link>
 </div>
 <div className="flex items-center gap-2 mt-1">
 <span className="text-blue-400 font-mono text-[11px] adm-surface px-2 py-0.5 rounded-lg border adm-divider truncate max-w-[160px]">
 /{tenant.slug}
 </span>
 <button
 type="button"
 onClick={() => setDomainModalTenant(tenant)}
 className="text-[10px] font-mono adm-surface hover:adm-surface text-cyan-300 border adm-divider px-2 py-0.5 rounded-lg cursor-pointer transition shrink-0"
 >
 <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 inline-block mr-1"><path fillRule="evenodd" d="M4.083 9h11.834a8 8 0 10-11.834 0zM10 2a8 8 0 100 16 8 8 0 000-16z" clipRule="evenodd" /></svg> Domains ({tenant.domainAliases?.length || 0})
 </button>
 </div>
 </td>

 {/* Admin Email */}
 <td className="py-4 px-4 font-mono adm-text-secondary text-[11px]">
 {tenant.adminEmail || `admin@${tenant.slug}.edu`}
 </td>

 {/* Plan Tier */}
 <td className="py-4 px-4">
 {activeTab === 'recycle_bin' ? (
 <span className="font-mono adm-text-muted text-xs">
 {tenant.archivedAt ? new Date(tenant.archivedAt).toLocaleDateString() : 'Recently'}
 </span>
 ) : (
 <select
 value={tenant.plan?.id || 'plan_growth'}
 onChange={(e) => handlePlanChange(tenant.id, e.target.value)}
 className="adm-surface border adm-divider rounded-xl px-2.5 py-1.5 text-xs adm-text-secondary font-bold focus:outline-none"
 >
 {availablePlans.map((p) => (
 <option key={p.id} value={p.id}>
 {p.name} (₦{Number(p.price).toLocaleString()}/term)
 </option>
 ))}
 </select>
 )}
 </td>

 {/* Status Select */}
 <td className="py-4 px-4">
 <select
 value={tenant.status}
 onChange={(e) => handleStatusChange(tenant.id, e.target.value as TenantStatus)}
 className={`rounded-xl px-2.5 py-1.5 text-xs font-bold border focus:outline-none ${
 tenant.status === 'active'
 ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800'
 : tenant.status === 'trial'
 ? 'bg-amber-950/80 text-amber-400 border-amber-800'
 : tenant.status === 'archived'
 ? 'bg-rose-950/80 text-rose-400 border-rose-800'
 : 'adm-surface adm-text-muted adm-divider'
 }`}
 >
 <option value="trial">Trial</option>
 <option value="active">Active</option>
 <option value="suspended">Suspended</option>
 <option value="archived">Archived</option>
 </select>
 </td>

 {/* Metrics */}
 <td className="py-4 px-4">
 <div className="flex items-center gap-1.5 font-mono text-[11px] adm-text-secondary">
 <span className="adm-surface px-2 py-0.5 rounded-md border border-slate-800/80"><svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 inline-block mr-1 text-sky-400"><path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3z" /></svg> {tenant._count.students}</span>
 <span className="adm-surface px-2 py-0.5 rounded-md border border-slate-800/80"><svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 inline-block mr-1 text-emerald-400"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" /></svg> {tenant._count.staff}</span>
 </div>
 </td>

 {/* Clean Spacious Horizontal Actions */}
 <td className="py-4 px-4 text-right">
 <div className="inline-flex items-center justify-end gap-1.5 flex-wrap sm:flex-nowrap">
 {activeTab === 'recycle_bin' ? (
 <>
 <button
 onClick={() => handleStatusChange(tenant.id, 'active')}
 className="px-3 py-1.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 rounded-xl text-xs font-bold transition cursor-pointer"
 title="Restore School to Active Directory"
 >
 ↺ Restore
 </button>
 <button
 onClick={() => handleExportTenantData(tenant.id, tenant.slug)}
 className="px-3 py-1.5 adm-surface hover:adm-surface text-cyan-300 border adm-divider rounded-xl text-xs font-bold transition cursor-pointer"
 title="Download JSON Snapshot Data"
 >
 <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 inline-block mr-1"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg> Export
 </button>
 <button
 onClick={() => {
 setPurgeTarget(tenant);
 setPurgeConfirmSlug('');
 setPurgeError('');
 }}
 className="px-3 py-1.5 bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded-xl text-xs font-bold transition cursor-pointer"
 title="Permanently Purge School & All Records"
 >
 <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 inline-block mr-1"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg> Purge
 </button>
 </>
 ) : (
 <>
 <button
 onClick={() => setImpersonateTarget(tenant)}
 className="px-3 py-1.5 bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-800 rounded-xl text-xs font-bold transition cursor-pointer"
 >
 <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 inline-block mr-1"><path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd" /></svg> Impersonate
 </button>
 <Link
 href={`/admin/tenants/${tenant.id}`}
 className="px-2.5 py-1.5 adm-surface hover:adm-surface adm-text-secondary border adm-divider rounded-xl text-xs font-semibold transition"
 title="Manage Settings & Overrides"
 >
 <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 inline-block"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" /></svg>
 </Link>
 <button
 onClick={() => handleExportTenantData(tenant.id, tenant.slug)}
 className="px-2.5 py-1.5 adm-surface hover:adm-surface text-cyan-300 border adm-divider rounded-xl text-xs font-semibold transition cursor-pointer"
 title="Export JSON Snapshot"
 >
 <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 inline-block mr-1"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
 </button>
 <button
 onClick={() => handleStatusChange(tenant.id, 'archived')}
 className="px-2.5 py-1.5 adm-surface hover:adm-surface text-rose-400 border adm-divider rounded-xl text-xs font-semibold transition cursor-pointer"
 title="Move to Recycle Bin"
 >
 <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 inline-block mr-1"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
 </button>
 </>
 )}
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </div>

 {/* Domain Aliases Modal */}
 {domainModalTenant && (
 <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
 <div className="max-w-md w-full max-h-[90vh] overflow-y-auto adm-card border adm-divider rounded-3xl p-6 shadow-2xl adm-text-primary space-y-4">
 <div className="flex justify-between items-center border-b adm-divider pb-3 sticky top-0 adm-card z-10">
 <div>
 <h2 className="text-lg font-bold">Custom Domains &amp; Subdomains</h2>
 <p className="text-xs adm-text-muted">{domainModalTenant.name} ({domainModalTenant.slug})</p>
 </div>
 <button onClick={() => setDomainModalTenant(null)} className="adm-text-muted hover:text-[var(--adm-text-primary)] font-bold cursor-pointer">
 ×
 </button>
 </div>

 <div className="space-y-2">
 {(domainModalTenant.domainAliases || []).length === 0 ? (
 <div className="p-4 text-center text-xs adm-text-muted adm-surface rounded-xl border adm-divider">
 No custom domain aliases configured. Default subdomain: <code className="text-blue-400 font-mono">{domainModalTenant.slug}.{ROOT_DOMAIN}</code>
 </div>
 ) : (
 (domainModalTenant.domainAliases || []).map((da) => (
 <div key={da.id} className="flex justify-between items-center adm-surface p-3 rounded-xl border adm-divider font-mono text-xs">
 <div className="flex items-center gap-2 truncate">
 <span className="text-blue-400 font-bold truncate"><svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 inline-block mr-1"><path fillRule="evenodd" d="M4.083 9h11.834a8 8 0 10-11.834 0zM10 2a8 8 0 100 16 8 8 0 000-16z" clipRule="evenodd" /></svg> {da.domain}</span>
 </div>
 <div className="flex items-center gap-2 shrink-0">
 <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-sans">
 Active Verified
 </span>
 <button
 type="button"
 onClick={() => handleRemoveDomainAlias(domainModalTenant.id, da.id)}
 className="adm-text-muted hover:text-rose-400 font-bold px-1 cursor-pointer"
 title="Remove Domain Alias"
 >
 ×
 </button>
 </div>
 </div>
 ))
 )}
 </div>

 {/* Form to Add Custom Domain (e.g. school.com) */}
 <div className="pt-3 border-t adm-divider space-y-3">
 <label className="text-xs font-semibold adm-text-muted block">
 Add Custom School Domain (e.g. apexacademy.com):
 </label>
 <div className="flex items-center gap-2">
 <input
 type="text"
 placeholder="portal.school.com or school.org"
 value={newCustomDomain}
 onChange={(e) => setNewCustomDomain(e.target.value)}
 className="flex-1 px-3 py-2 adm-surface border adm-divider rounded-xl text-xs font-mono adm-text-primary focus:outline-none focus:border-blue-500"
 />
 <button
 type="button"
 onClick={() => handleAddDomainAlias(domainModalTenant.id)}
 disabled={addingDomain || !newCustomDomain.trim()}
 className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition cursor-pointer shrink-0"
 >
 {addingDomain ? 'Adding...' : '+ Add Domain'}
 </button>
 </div>

 {/* DNS Provider Setup Instructions */}
 <div className="adm-surface p-3.5 rounded-2xl border border-blue-900/50 space-y-2 text-[11px] adm-text-secondary">
 <div className="font-bold text-blue-300 flex items-center gap-1.5">
 <span><svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 inline-block mr-1.5"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h6a1 1 0 100-2H7zm0 4a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg> DNS Provider Setup (Namecheap, GoDaddy, Cloudflare)</span>
 </div>
 <p className="adm-text-muted leading-relaxed text-[10.5px]">
 To route your custom domain to our system, log in to your domain registrar (e.g. GoDaddy/Namecheap) and add these DNS records:
 </p>
 <div className="space-y-1.5 font-mono text-[10px]">
 <div className="adm-card p-2.5 rounded-xl border adm-divider">
 <span className="text-amber-400 font-bold block mb-0.5">Subdomain (e.g. portal.school.com):</span>
 <div className="adm-text-secondary">Type: <span className="text-cyan-400 font-bold">CNAME</span> | Name: <span className="text-slate-100 font-bold">portal</span></div>
 <div className="adm-text-secondary">Target: <span className="text-emerald-400 font-bold">cname.edusaas.com</span></div>
 </div>
 <div className="adm-card p-2.5 rounded-xl border adm-divider">
 <span className="text-emerald-400 font-bold block mb-0.5">Apex / Root Domain (e.g. school.com):</span>
 <div className="adm-text-secondary">Type: <span className="text-cyan-400 font-bold">A Record</span> | Name: <span className="text-slate-100 font-bold">@</span></div>
 <div className="adm-text-secondary">Target IP: <span className="text-emerald-400 font-bold">185.199.108.153</span></div>
 </div>
 </div>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* Create Tenant Modal */}
 {showCreateModal && (
 <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
 <div className="max-w-md w-full adm-card border adm-divider rounded-3xl p-6 sm:p-8 shadow-2xl adm-text-primary space-y-5">
 <div className="flex justify-between items-center border-b adm-divider pb-3">
 <h2 className="text-lg font-bold">Onboard New School Tenant</h2>
 <button onClick={() => setShowCreateModal(false)} className="adm-text-muted hover:text-[var(--adm-text-primary)] font-bold cursor-pointer">
 ×
 </button>
 </div>

 {createError && (
 <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs font-semibold">
 {createError}
 </div>
 )}

 <form onSubmit={handleCreateTenant} className="space-y-4 text-xs">
 <div>
 <label className="block adm-text-muted font-semibold mb-1">School Name</label>
 <input
 type="text"
 required
 placeholder="e.g. St. Nicholas International School"
 value={newName}
 onChange={(e) => {
 setNewName(e.target.value);
 if (!newSlug) {
 setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'));
 }
 }}
 className="w-full px-3.5 py-2.5 adm-surface border adm-divider rounded-xl adm-text-primary focus:outline-none focus:border-blue-500"
 />
 </div>

 <div>
 <label className="block adm-text-muted font-semibold mb-1">Subdomain Slug</label>
 <input
 type="text"
 required
 placeholder="st-nicholas"
 value={newSlug}
 onChange={(e) => setNewSlug(e.target.value.toLowerCase())}
 className="w-full px-3.5 py-2.5 adm-surface border adm-divider rounded-xl adm-text-primary font-mono focus:outline-none focus:border-blue-500"
 />
 <p className="text-[10px] adm-text-muted mt-1">Will be accessible at {newSlug || 'slug'}.{ROOT_DOMAIN}</p>
 </div>

 <div>
 <label className="block adm-text-muted font-semibold mb-1">Subscription Tier</label>
 <select
 value={newPlanId}
 onChange={(e) => setNewPlanId(e.target.value)}
 className="w-full px-3.5 py-2.5 adm-surface border adm-divider rounded-xl adm-text-primary font-semibold focus:outline-none"
 >
 {availablePlans.map((p) => (
 <option key={p.id} value={p.id}>
 {p.name} — ₦{Number(p.price).toLocaleString()}/term
 </option>
 ))}
 </select>
 </div>

 <div className="pt-2 flex justify-end space-x-2">
 <button
 type="button"
 onClick={() => setShowCreateModal(false)}
 className="px-4 py-2 adm-surface hover:bg-[var(--adm-surface-hover)] adm-text-secondary font-bold rounded-xl cursor-pointer"
 >
 Cancel
 </button>
 <button
 type="submit"
 disabled={creating}
 className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 transition cursor-pointer disabled:opacity-50"
 >
 {creating ? 'Provisioning...' : 'Provision Tenant <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 inline-block mr-1"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.381z" clipRule="evenodd" /></svg>'}
 </button>
 </div>
 </form>
 </div>
 </div>
 )}

 {/* Import Snapshot Modal */}
 {showImportModal && (
 <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
 <div className="max-w-lg w-full adm-card border adm-divider rounded-3xl p-6 sm:p-8 shadow-2xl adm-text-primary space-y-5">
 <div className="flex justify-between items-center border-b adm-divider pb-3">
 <div>
 <h2 className="text-lg font-bold"><svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 inline-block mr-1"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg> Import School Snapshot (JSON)</h2>
 <p className="text-xs adm-text-muted">Restore or import NDPR compliance JSON data archives</p>
 </div>
 <button onClick={() => setShowImportModal(false)} className="adm-text-muted hover:text-[var(--adm-text-primary)] font-bold cursor-pointer">
 ×
 </button>
 </div>

 {importError && (
 <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs font-semibold">
 {importError}
 </div>
 )}

 <form onSubmit={handleImportSnapshot} className="space-y-4 text-xs">
 <div>
 <label className="block adm-text-muted font-semibold mb-1">Select JSON Snapshot File</label>
 <input
 type="file"
 accept=".json,application/json"
 onChange={handleFileUpload}
 className="w-full text-xs adm-text-muted file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-950 file:text-blue-300 hover:file:bg-blue-900 cursor-pointer"
 />
 </div>

 <div>
 <label className="block adm-text-muted font-semibold mb-1">Or Paste JSON Content</label>
 <textarea
 rows={4}
 placeholder='{"tenant": {"name": "Apex Academy", "slug": "apex"}, ...}'
 value={importJsonText}
 onChange={(e) => setImportJsonText(e.target.value)}
 className="w-full px-3.5 py-2.5 adm-surface border adm-divider rounded-xl adm-text-primary font-mono text-[11px] focus:outline-none focus:border-blue-500"
 />
 </div>

 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block adm-text-muted font-semibold mb-1">School Name (Optional)</label>
 <input
 type="text"
 placeholder="Auto-detected from JSON"
 value={importNameOverride}
 onChange={(e) => setImportNameOverride(e.target.value)}
 className="w-full px-3 py-2 adm-surface border adm-divider rounded-xl adm-text-primary focus:outline-none"
 />
 </div>
 <div>
 <label className="block adm-text-muted font-semibold mb-1">Subdomain Slug (Optional)</label>
 <input
 type="text"
 placeholder="Auto-detected"
 value={importSlugOverride}
 onChange={(e) => setImportSlugOverride(e.target.value)}
 className="w-full px-3 py-2 adm-surface border adm-divider rounded-xl adm-text-primary font-mono focus:outline-none"
 />
 </div>
 </div>

 <div className="pt-2 flex justify-end space-x-2">
 <button
 type="button"
 onClick={() => setShowImportModal(false)}
 className="px-4 py-2 adm-surface hover:bg-[var(--adm-surface-hover)] adm-text-secondary font-bold rounded-xl cursor-pointer"
 >
 Cancel
 </button>
 <button
 type="submit"
 disabled={importing || !importJsonText.trim()}
 className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 transition cursor-pointer disabled:opacity-50"
 >
 {importing ? 'Importing Snapshot...' : 'Import & Restore School <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 inline-block mr-1"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.381z" clipRule="evenodd" /></svg>'}
 </button>
 </div>
 </form>
 </div>
 </div>
 )}

 {/* Impersonate Modal */}
 {impersonateTarget && (
 <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
 <div className="max-w-md w-full adm-card border adm-divider rounded-3xl p-6 sm:p-8 shadow-2xl adm-text-primary space-y-5">
 <div className="flex justify-between items-center border-b adm-divider pb-3">
 <div>
 <h2 className="text-lg font-bold text-red-400"><svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 inline-block mr-1"><path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd" /></svg> Super Admin Impersonation</h2>
 <p className="text-xs adm-text-muted">Access {impersonateTarget.name} ({impersonateTarget.slug})</p>
 </div>
 <button onClick={() => setImpersonateTarget(null)} className="adm-text-muted hover:text-[var(--adm-text-primary)] font-bold cursor-pointer">
 ×
 </button>
 </div>

 {impersonateError && (
 <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs font-semibold">
 {impersonateError}
 </div>
 )}

 <form onSubmit={handleStartImpersonation} className="space-y-4 text-xs">
 <div>
 <label className="block adm-text-muted font-semibold mb-1">Mandatory Impersonation Reason</label>
 <textarea
 required
 rows={3}
 placeholder="e.g. Assisting school principal with result PIN generation troubleshooting..."
 value={impersonateReason}
 onChange={(e) => setImpersonateReason(e.target.value)}
 className="w-full px-3 py-2 adm-surface border adm-divider rounded-xl adm-text-primary focus:outline-none focus:border-red-500"
 />
 </div>

 <div className="pt-2 flex justify-end space-x-2">
 <button
 type="button"
 onClick={() => setImpersonateTarget(null)}
 className="px-4 py-2 adm-surface hover:bg-[var(--adm-surface-hover)] adm-text-secondary font-bold rounded-xl cursor-pointer"
 >
 Cancel
 </button>
 <button
 type="submit"
 disabled={impersonating || !impersonateReason.trim()}
 className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-lg shadow-red-600/30 transition cursor-pointer disabled:opacity-50"
 >
 {impersonating ? 'Launching Session...' : 'Confirm & Launch Impersonation <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 inline-block mr-1"><path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd" /></svg>'}
 </button>
 </div>
 </form>
 </div>
 </div>
 )}

 {/* Permanent Purge Confirmation Modal */}
 {purgeTarget && (
 <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
 <div className="max-w-md w-full adm-card border border-rose-900/80 rounded-3xl p-6 sm:p-8 shadow-2xl adm-text-primary space-y-5">
 <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center text-2xl mx-auto">
 <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 inline-block text-amber-400 mr-1"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
 </div>
 <div className="text-center">
 <h3 className="text-xl font-bold adm-text-primary">Permanently Purge Institution</h3>
 <p className="text-xs adm-text-muted mt-2 leading-relaxed">
 You are about to permanently purge <strong className="adm-text-primary">{purgeTarget.name}</strong> (<code className="text-rose-400 font-mono">{purgeTarget.slug}</code>). All student rosters, grade records, staff accounts, fee payments, and domain aliases will be destroyed.
 </p>
 </div>

 {purgeError && (
 <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs font-semibold text-center">
 {purgeError}
 </div>
 )}

 <div className="space-y-2">
 <label className="text-[11px] font-mono adm-text-muted uppercase tracking-wider block">
 Type <strong className="text-rose-400">{purgeTarget.slug}</strong> to confirm:
 </label>
 <input
 type="text"
 placeholder={purgeTarget.slug}
 value={purgeConfirmSlug}
 onChange={(e) => setPurgeConfirmSlug(e.target.value)}
 className="w-full px-4 py-3 adm-surface border adm-divider rounded-xl text-sm font-mono adm-text-primary focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
 />
 </div>

 <div className="flex items-center gap-3 pt-2">
 <button
 type="button"
 onClick={() => {
 setPurgeTarget(null);
 setPurgeConfirmSlug('');
 setPurgeError('');
 }}
 disabled={purging}
 className="w-1/2 py-3 rounded-xl adm-surface hover:bg-[var(--adm-surface-hover)] adm-text-secondary font-bold text-xs transition cursor-pointer"
 >
 Cancel
 </button>
 <button
 type="button"
 onClick={handleHardDeleteTenant}
 disabled={purging || purgeConfirmSlug.trim() !== purgeTarget.slug}
 className="w-1/2 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition flex items-center justify-center gap-2 cursor-pointer"
 >
 {purging ? (
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
