'use client';

import React, { useState } from 'react';
import { BUILT_IN_FEATURE_CAPABILITIES, type BuiltInFeatureKey } from '@/lib/feature-catalog';
import { useLanguage } from '@/components/language-provider';

interface FeatureData {
 key: string;
 name: string;
 description: string | null;
}

interface FeatureCapability {
 key: BuiltInFeatureKey;
 name: string;
 description: string;
}

interface PlanFeatureData {
 featureKey: string;
 enabledByDefault: boolean;
 feature: FeatureData;
}

interface PlanData {
 id: string;
 name: string;
 studentCeiling: number;
 price: number;
 pinRequired: boolean;
 platformFeePercent: number;
 features: PlanFeatureData[];
 _count?: { tenants: number };
}

interface PlansClientProps {
 initialPlans: PlanData[];
 initialFeatures: FeatureData[];
 initialAvailableCapabilities: FeatureCapability[];
}

export function PlansClient({ initialPlans, initialFeatures, initialAvailableCapabilities }: PlansClientProps) {
 const { formatMoney, localization } = useLanguage();
 const [plans, setPlans] = useState<PlanData[]>(initialPlans);
 const [features, setFeatures] = useState<FeatureData[]>(initialFeatures);
 const [availableCapabilities, setAvailableCapabilities] = useState<FeatureCapability[]>(initialAvailableCapabilities);

 // Edit Plan State
 const [editingPlan, setEditingPlan] = useState<PlanData | null>(null);
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [success, setSuccess] = useState<string | null>(null);

 // New Feature Modal State
 const [showAddFeature, setShowAddFeature] = useState(false);
 const [editingFeature, setEditingFeature] = useState<FeatureData | null>(null);
 const [newFeatureKey, setNewFeatureKey] = useState<BuiltInFeatureKey | ''>('');
 const [newFeatureName, setNewFeatureName] = useState('');
 const [newFeatureDesc, setNewFeatureDesc] = useState('');

 // Delete Feature Definition
 const handleDeleteFeature = async (featureKey: string, featureName: string) => {
 if (!confirm(`Remove "${featureName}" (${featureKey}) from the registry? It can only be removed after it has been unassigned from every plan and school.`)) {
 return;
 }

 setSaving(true);
 try {
 const res = await fetch(`/api/admin/features?key=${encodeURIComponent(featureKey)}`, {
 method: 'DELETE',
 });

 const data = await res.json();
 if (!res.ok) {
 alert(data.error || 'Failed to delete feature');
 } else {
 setFeatures((prev) => prev.filter((f) => f.key !== featureKey));
 const available = BUILT_IN_FEATURE_CAPABILITIES.find((capability) => capability.key === featureKey);
 if (available) setAvailableCapabilities((prev) => [...prev, available].sort((a, b) => a.name.localeCompare(b.name)));
 setPlans((prev) =>
 prev.map((p) => ({
 ...p,
 features: p.features.filter((pf) => pf.featureKey !== featureKey),
 }))
 );
 }
 } catch (err) {
 alert('Network error deleting feature');
 } finally {
 setSaving(false);
 }
 };

 // New Plan Modal State
 const [showAddPlan, setShowAddPlan] = useState(false);
 const [newPlanName, setNewPlanName] = useState('');
 const [newPlanPrice, setNewPlanPrice] = useState('150000');
 const [newPlanCeiling, setNewPlanCeiling] = useState('500');
 const [newPlanFee, setNewPlanFee] = useState('5');
 const [newPlanPinReq, setNewPlanPinReq] = useState(true);

 // Handle Feature Toggle per Plan
 const handleToggleFeature = async (plan: PlanData, featureKey: string) => {
 const existingKeys = plan.features.map((f) => f.featureKey);
 const hasKey = existingKeys.includes(featureKey);

 const updatedKeys = hasKey
 ? existingKeys.filter((k) => k !== featureKey)
 : [...existingKeys, featureKey];

 setSaving(true);
 try {
 const res = await fetch('/api/admin/plans', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 id: plan.id,
 name: plan.name,
 studentCeiling: plan.studentCeiling,
 price: plan.price,
 pinRequired: plan.pinRequired,
 platformFeePercent: plan.platformFeePercent,
 featureKeys: updatedKeys,
 }),
 });

 const data = await res.json();
 if (!res.ok) {
 alert(data.error || 'Failed to update plan feature');
 } else {
 setPlans((prev) => prev.map((p) => (p.id === plan.id ? data.plan : p)));
 }
 } catch (err) {
 alert('Network error updating plan feature');
 } finally {
 setSaving(false);
 }
 };

 // Save Plan Edits (Price, Ceiling, PIN Fee)
 const handleSavePlanEdits = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!editingPlan) return;

 setSaving(true);
 setError(null);
 setSuccess(null);

 try {
 const res = await fetch('/api/admin/plans', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 id: editingPlan.id,
 name: editingPlan.name,
 studentCeiling: editingPlan.studentCeiling,
 price: editingPlan.price,
 pinRequired: editingPlan.pinRequired,
 platformFeePercent: editingPlan.platformFeePercent,
 featureKeys: editingPlan.features.map((f) => f.featureKey),
 }),
 });

 const data = await res.json();
 if (!res.ok) {
 setError(data.error || 'Failed to save plan edits');
 } else {
 setPlans((prev) => prev.map((p) => (p.id === editingPlan.id ? data.plan : p)));
 setSuccess(`Plan "${editingPlan.name}" updated successfully!`);
 setTimeout(() => {
 setEditingPlan(null);
 setSuccess(null);
 }, 1200);
 }
 } catch (err) {
 setError('Network error saving plan edits');
 } finally {
 setSaving(false);
 }
 };

 // Create New Feature Definition
 const handleCreateFeature = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!newFeatureKey || !newFeatureName || !availableCapabilities.some((capability) => capability.key === newFeatureKey)) return;

 setSaving(true);
 try {
 const res = await fetch('/api/admin/features', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 key: newFeatureKey,
 name: newFeatureName,
 description: newFeatureDesc,
 }),
 });

 const data = await res.json();
 if (!res.ok) {
 alert(data.error || 'Failed to create feature');
 } else {
     setFeatures((prev) => [...prev.filter((f) => f.key !== data.feature.key), data.feature].sort((a, b) => a.name.localeCompare(b.name)));
     setAvailableCapabilities((prev) => prev.filter((capability) => capability.key !== data.feature.key));
 setShowAddFeature(false);
 setNewFeatureKey('');
 setNewFeatureName('');
 setNewFeatureDesc('');
 }
 } catch (err) {
 alert('Network error creating feature');
 } finally {
 setSaving(false);
 }
 };

 // Save Feature Edits (Name, Description)
 const handleSaveFeatureEdit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!editingFeature) return;

 setSaving(true);
 try {
 const res = await fetch('/api/admin/features', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 key: editingFeature.key,
 name: editingFeature.name,
 description: editingFeature.description,
 }),
 });

 const data = await res.json();
 if (!res.ok) {
 alert(data.error || 'Failed to update feature');
 } else {
 setFeatures((prev) =>
 prev.map((f) => (f.key === editingFeature.key ? data.feature : f))
 );
 setEditingFeature(null);
 }
 } catch (err) {
 alert('Network error updating feature');
 } finally {
 setSaving(false);
 }
 };

 // Create New Subscription Plan Tier
 const handleCreatePlan = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!newPlanName) return;

 setSaving(true);
 try {
 const res = await fetch('/api/admin/plans', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 name: newPlanName,
 price: Number(newPlanPrice),
 studentCeiling: Number(newPlanCeiling),
 platformFeePercent: Number(newPlanFee),
 pinRequired: newPlanPinReq,
 featureKeys: [], // New plans start with no entitlements; select features deliberately.
 }),
 });

 const data = await res.json();
 if (!res.ok) {
 alert(data.error || 'Failed to create plan');
 } else {
 setPlans((prev) => [...prev.filter((p) => p.id !== data.plan.id), data.plan]);
 setShowAddPlan(false);
 setNewPlanName('');
 }
 } catch (err) {
 alert('Network error creating plan');
 } finally {
 setSaving(false);
 }
 };

 // Delete Subscription Plan Tier
 const handleDeletePlan = async (plan: PlanData) => {
 if (!confirm(`Are you sure you want to delete plan "${plan.name}" (${plan.id})?`)) {
 return;
 }

 setSaving(true);
 try {
 const res = await fetch(`/api/admin/plans?id=${encodeURIComponent(plan.id)}`, {
 method: 'DELETE',
 });

 const data = await res.json();
 if (!res.ok) {
 alert(data.error || 'Failed to delete plan');
 } else {
 setPlans((prev) => prev.filter((p) => p.id !== plan.id));
 }
 } catch (err) {
 alert('Network error deleting plan');
 } finally {
 setSaving(false);
 }
 };

 return (
 <div className="space-y-10">
 {/* Header Bar with Quick Action CTAs */}
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b adm-divider">
 <div>
 <h1 className="text-2xl font-bold tracking-tight adm-text-primary">Subscription Tier & Feature Control Plane</h1>
 <p className="text-xs adm-text-muted mt-1 leading-relaxed">
 Configure plan prices (in {localization.baseCurrencyCode || localization.currencyCode}), student limits, platform fee percentages, and manage the feature registry.
 </p>
 </div>

 <div className="flex items-center gap-3 shrink-0">
 <button
 type="button"
 onClick={() => setShowAddFeature(true)}
 className="px-4 py-2 rounded-lg text-xs font-semibold adm-surface border adm-divider adm-text-secondary adm-surface-hover transition-colors flex items-center gap-1.5 cursor-pointer"
 >
 <span>+</span>
 <span>Add Feature</span>
 </button>
 <button
 type="button"
 onClick={() => setShowAddPlan(true)}
 className="adm-btn-primary px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
 >
 <span>+</span>
 <span>Create New Plan</span>
 </button>
 </div>
 </div>

 {/* Plan Tiers Display Cards */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
 {plans.map((p) => {
 const enabledKeys = p.features.map((f) => f.featureKey);
 return (
 <div
 key={p.id}
 className="adm-card border rounded-2xl p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all"
 >
 <div>
 <div className="flex justify-between items-center mb-3">
 <h3 className="text-lg font-bold adm-text-primary">{p.name}</h3>
 <span className="text-xs font-mono adm-surface border adm-divider adm-text-muted px-2.5 py-1 rounded-lg">
 {p._count?.tenants || 0} Schools Active
 </span>
 </div>

 <div className="mb-5">
 <span className="text-3xl font-bold adm-text-primary tabular-nums">{formatMoney(Number(p.price), 0)}</span>
 <span className="adm-text-muted text-xs"> / year</span>
 </div>

 <div className="space-y-1.5 adm-surface border adm-divider p-4 rounded-xl mb-5 text-xs font-mono">
 <div className="flex justify-between">
 <span className="adm-text-muted">Student Ceiling:</span>
 <strong className="adm-text-primary">{p.studentCeiling} Students</strong>
 </div>
 <div className="flex justify-between">
 <span className="adm-text-muted">Platform PIN Fee:</span>
 <strong className="text-emerald-500">{Number(p.platformFeePercent)}%</strong>
 </div>
 <div className="flex justify-between">
 <span className="adm-text-muted">PIN Required:</span>
 <strong className="adm-text-primary">{p.pinRequired ? 'Yes' : 'No'}</strong>
 </div>
 </div>

 <div className="mb-6">
 <h4 className="text-[10px] font-semibold uppercase tracking-widest adm-text-muted mb-2">
 Feature Allocation Matrix
 </h4>
 <div className="space-y-2">
 {features.map((f) => {
 const isEnabled = enabledKeys.includes(f.key);
 return (
 <label
 key={f.key}
 className="flex items-center justify-between p-2.5 rounded-lg adm-surface border adm-divider adm-surface-hover transition-colors cursor-pointer text-xs"
 >
 <span className="adm-text-secondary font-medium">{f.name}</span>
 <input
 type="checkbox"
 checked={isEnabled}
 disabled={saving}
 onChange={() => handleToggleFeature(p, f.key)}
 className="w-4 h-4 rounded adm-card adm-divider accent-[var(--adm-accent)] cursor-pointer"
 />
 </label>
 );
 })}
 </div>
 </div>
 </div>

 <div className="pt-4 border-t adm-divider flex items-center justify-between gap-2">
 <span className="text-[11px] font-mono adm-text-muted truncate" title={p.id}>ID: {p.id}</span>
 <div className="flex items-center gap-2">
 <button
 type="button"
 onClick={() => handleDeletePlan(p)}
 className="px-2.5 py-1.5 rounded-lg text-xs font-medium adm-surface hover:bg-rose-500/10 adm-text-muted hover:text-rose-500 border adm-divider hover:border-rose-500/30 transition-colors cursor-pointer"
 title="Delete Plan"
 >
 Delete
 </button>
 <button
 type="button"
 onClick={() => setEditingPlan(p)}
 className="adm-btn-primary px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
 >
 Edit
 </button>
 </div>
 </div>
 </div>
 );
 })}
 </div>

 {/* Feature Registry Table */}
 <div className="adm-card border adm-divider rounded-2xl overflow-hidden">
 <div className="px-6 py-4 border-b adm-divider adm-surface flex justify-between items-center">
 <div>
 <h2 className="font-semibold text-[15px] adm-text-primary">Connected Platform Modules</h2>
 <p className="text-xs adm-text-muted mt-0.5">Built-in modules connected to plan controls. Each module is enforced when its access switch is off.</p>
 </div>
 <button
 type="button"
 onClick={() => setShowAddFeature(true)}
 className="px-3 py-1.5 rounded-lg text-xs font-semibold adm-card adm-surface-hover adm-text-secondary border adm-divider cursor-pointer"
 >
 + Register Feature
 </button>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-6">
 {features.map((f) => (
 <div key={f.key} className="adm-surface p-4 rounded-xl border adm-divider space-y-1.5 group transition-colors flex flex-col justify-between">
 <div>
 <div className="flex items-center justify-between">
 <span className="text-[11px] font-mono font-semibold adm-text-accent block">{f.key}</span>
 <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
 <button
 type="button"
 onClick={() => setEditingFeature(f)}
 className="p-1 rounded text-xs adm-text-muted hover:text-[var(--adm-text-primary)] hover:adm-surface transition-colors"
 title="Edit Feature"
 >
 <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 inline-block mr-1"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.381z" clipRule="evenodd" /></svg>
 </button>
 <button
 type="button"
 onClick={() => handleDeleteFeature(f.key, f.name)}
 className="p-1 rounded text-xs adm-text-muted hover:text-red-400 hover:adm-surface transition-colors"
 title="Delete Feature"
 >
 <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 inline-block mr-1"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
 </button>
 </div>
 </div>
 <h4 className="text-sm font-semibold adm-text-primary mt-1">{f.name}</h4>
 <p className="text-xs adm-text-muted leading-relaxed mt-0.5">{f.description || 'System feature flag'}</p>
 </div>
 </div>
 ))}
 </div>
 </div>

 {/* Edit Plan Modal */}
 {editingPlan && (
 <div className="fixed inset-0 z-[100000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
 <div className="adm-card border adm-divider rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5">
 <div className="flex justify-between items-center pb-3 border-b adm-divider">
 <h3 className="text-lg font-bold adm-text-primary">Edit Plan: {editingPlan.name}</h3>
 <button
 type="button"
 onClick={() => setEditingPlan(null)}
 className="adm-text-muted hover:text-[var(--adm-text-primary)] font-bold text-sm"
 >
 ×
 </button>
 </div>

 {error && <div className="p-3 rounded-lg bg-red-950 text-red-300 text-xs font-mono">{error}</div>}
 {success && <div className="p-3 rounded-lg bg-emerald-950 text-emerald-300 text-xs font-mono">{success}</div>}

 <form onSubmit={handleSavePlanEdits} className="space-y-4">
 <div>
 <label className="block text-xs font-mono uppercase adm-text-muted mb-1">Plan Display Name</label>
 <input
 type="text"
 value={editingPlan.name}
 onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
 required
 className="w-full adm-surface border adm-divider rounded-xl px-4 py-2.5 adm-text-primary text-sm focus:outline-none focus:border-blue-500"
 />
 </div>

 <div>
 <label className="block text-xs font-mono uppercase adm-text-muted mb-1">Price per Academic Year ({localization.baseCurrencyCode || localization.currencyCode})</label>
 <input
 type="number"
 value={editingPlan.price}
 onChange={(e) => setEditingPlan({ ...editingPlan, price: Number(e.target.value) })}
 required
 min="0"
 className="w-full adm-surface border adm-divider rounded-xl px-4 py-2.5 adm-text-primary text-sm focus:outline-none focus:border-blue-500 font-mono"
 />
 </div>

 <div>
 <label className="block text-xs font-mono uppercase adm-text-muted mb-1">Max Student Ceiling Limit</label>
 <input
 type="number"
 value={editingPlan.studentCeiling}
 onChange={(e) => setEditingPlan({ ...editingPlan, studentCeiling: Number(e.target.value) })}
 required
 min="1"
 className="w-full adm-surface border adm-divider rounded-xl px-4 py-2.5 adm-text-primary text-sm focus:outline-none focus:border-blue-500 font-mono"
 />
 </div>

 <div>
 <label className="block text-xs font-mono uppercase adm-text-muted mb-1">Platform PIN Fee (%)</label>
 <input
 type="number"
 step="0.1"
 value={editingPlan.platformFeePercent}
 onChange={(e) => setEditingPlan({ ...editingPlan, platformFeePercent: Number(e.target.value) })}
 required
 min="0"
 max="100"
 className="w-full adm-surface border adm-divider rounded-xl px-4 py-2.5 adm-text-primary text-sm focus:outline-none focus:border-blue-500 font-mono"
 />
 </div>

 <div className="flex items-center gap-3 pt-2">
 <input
 type="checkbox"
 id="pinRequired"
 checked={editingPlan.pinRequired}
 onChange={(e) => setEditingPlan({ ...editingPlan, pinRequired: e.target.checked })}
 className="w-4 h-4 rounded adm-surface adm-divider text-blue-600 focus:ring-blue-500"
 />
 <label htmlFor="pinRequired" className="text-xs adm-text-secondary font-medium cursor-pointer">
 Require Scratch Card PIN for Result Checker
 </label>
 </div>

 <div className="flex justify-end gap-3 pt-4 border-t adm-divider">
 <button
 type="button"
 onClick={() => setEditingPlan(null)}
 className="px-4 py-2 rounded-xl text-xs font-semibold adm-surface adm-text-secondary hover:bg-[var(--adm-surface-hover)]"
 >
 Cancel
 </button>
 <button
 type="submit"
 disabled={saving}
 className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md disabled:opacity-50"
 >
 {saving ? 'Saving...' : 'Save Plan Settings'}
 </button>
 </div>
 </form>
 </div>
 </div>
 )}

 {/* Add New Plan Modal */}
 {showAddPlan && (
 <div className="fixed inset-0 z-[100000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
 <div className="adm-card border adm-divider rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5">
 <div className="flex justify-between items-center pb-3 border-b adm-divider">
 <h3 className="text-lg font-bold adm-text-primary">Create Subscription Plan Tier</h3>
 <button
 type="button"
 onClick={() => setShowAddPlan(false)}
 className="adm-text-muted hover:text-[var(--adm-text-primary)] font-bold text-sm"
 >
 ×
 </button>
 </div>

 <form onSubmit={handleCreatePlan} className="space-y-4">
 <div>
 <label className="block text-xs font-mono uppercase adm-text-muted mb-1">Plan Name</label>
 <input
 type="text"
 value={newPlanName}
 onChange={(e) => setNewPlanName(e.target.value)}
 placeholder="e.g. Premium Tier"
 required
 className="w-full adm-surface border adm-divider rounded-xl px-4 py-2.5 adm-text-primary text-sm focus:outline-none focus:border-red-500"
 />
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-xs font-mono uppercase adm-text-muted mb-1">Price ({localization.baseCurrencyCode || localization.currencyCode} / year)</label>
 <input
 type="number"
 value={newPlanPrice}
 onChange={(e) => setNewPlanPrice(e.target.value)}
 required
 className="w-full adm-surface border adm-divider rounded-xl px-4 py-2.5 adm-text-primary text-sm font-mono focus:outline-none"
 />
 </div>
 <div>
 <label className="block text-xs font-mono uppercase adm-text-muted mb-1">Student Ceiling</label>
 <input
 type="number"
 value={newPlanCeiling}
 onChange={(e) => setNewPlanCeiling(e.target.value)}
 required
 className="w-full adm-surface border adm-divider rounded-xl px-4 py-2.5 adm-text-primary text-sm font-mono focus:outline-none"
 />
 </div>
 </div>

 <div className="flex justify-end gap-3 pt-4 border-t adm-divider">
 <button
 type="button"
 onClick={() => setShowAddPlan(false)}
 className="px-4 py-2 rounded-xl text-xs font-semibold adm-surface adm-text-secondary hover:bg-[var(--adm-surface-hover)]"
 >
 Cancel
 </button>
 <button
 type="submit"
 disabled={saving}
 className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white shadow-md disabled:opacity-50"
 >
 {saving ? 'Creating...' : 'Create Plan Tier'}
 </button>
 </div>
 </form>
 </div>
 </div>
 )}

 {/* Add New Feature Modal */}
 {showAddFeature && (
 <div className="fixed inset-0 z-[100000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
 <div className="adm-card border adm-divider rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5">
 <div className="flex justify-between items-center pb-3 border-b adm-divider">
 <h3 className="text-lg font-bold adm-text-primary">Connect an Existing BMS Module</h3>
 <button
 type="button"
 onClick={() => setShowAddFeature(false)}
 className="adm-text-muted hover:text-[var(--adm-text-primary)] font-bold text-sm"
 >
 ×
 </button>
 </div>

 <form onSubmit={handleCreateFeature} className="space-y-4">
 <div>
 <label className="block text-xs font-mono uppercase adm-text-muted mb-1">Existing BMS module to connect</label>
 <select
 value={newFeatureKey}
 onChange={(e) => {
   const capability = availableCapabilities.find((item) => item.key === e.target.value);
   setNewFeatureKey((capability?.key || '') as BuiltInFeatureKey | '');
   setNewFeatureName(capability?.name || '');
   setNewFeatureDesc(capability?.description || '');
 }}
 required
 className="w-full adm-surface border adm-divider rounded-xl px-4 py-2.5 adm-text-primary text-sm focus:outline-none focus:border-cyan-500"
 >
 <option value="">Choose an existing module</option>
 {availableCapabilities.map((capability) => <option key={capability.key} value={capability.key}>{capability.name}</option>)}
 </select>
 <p className="mt-1.5 text-[11px] adm-text-muted">This connects plan access to a module already built in BMS. It does not create new functionality.</p>
 {availableCapabilities.length === 0 && <p className="mt-2 text-xs text-amber-600">All supported modules are already in the feature registry.</p>}
 </div>

 <div>
 <label className="block text-xs font-mono uppercase adm-text-muted mb-1">Display Name</label>
 <input
 type="text"
 value={newFeatureName}
 onChange={(e) => setNewFeatureName(e.target.value)}
 placeholder="e.g. SMS Parent Alerts"
 required
 className="w-full adm-surface border adm-divider rounded-xl px-4 py-2.5 adm-text-primary text-sm focus:outline-none focus:border-cyan-500"
 />
 </div>

 <div>
 <label className="block text-xs font-mono uppercase adm-text-muted mb-1">Description</label>
 <textarea
 value={newFeatureDesc}
 onChange={(e) => setNewFeatureDesc(e.target.value)}
 placeholder="Brief description of this feature capability..."
 rows={3}
 className="w-full adm-surface border adm-divider rounded-xl p-3 adm-text-primary text-xs focus:outline-none focus:border-cyan-500"
 />
 </div>

 <div className="flex justify-end gap-3 pt-4 border-t adm-divider">
 <button
 type="button"
 onClick={() => setShowAddFeature(false)}
 className="px-4 py-2 rounded-xl text-xs font-semibold adm-surface adm-text-secondary hover:bg-[var(--adm-surface-hover)]"
 >
 Cancel
 </button>
 <button
 type="submit"
 disabled={saving || availableCapabilities.length === 0}
 className="px-5 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-md disabled:opacity-50"
 >
 {saving ? 'Connecting...' : 'Connect Module'}
 </button>
 </div>
 </form>
 </div>
 </div>
 )}

 {/* Edit Feature Modal */}
 {editingFeature && (
 <div className="fixed inset-0 z-[100000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
 <div className="adm-card border adm-divider rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5">
 <div className="flex justify-between items-center pb-3 border-b adm-divider">
 <h3 className="text-lg font-bold adm-text-primary">Edit Feature: {editingFeature.key}</h3>
 <button
 type="button"
 onClick={() => setEditingFeature(null)}
 className="adm-text-muted hover:text-[var(--adm-text-primary)] font-bold text-sm"
 >
 ×
 </button>
 </div>

 <form onSubmit={handleSaveFeatureEdit} className="space-y-4">
 <div>
 <label className="block text-xs font-mono uppercase adm-text-muted mb-1">Feature Key</label>
 <input
 type="text"
 value={editingFeature.key}
 disabled
 className="w-full bg-slate-950/60 border adm-divider rounded-xl px-4 py-2.5 adm-text-muted text-sm font-mono cursor-not-allowed"
 />
 </div>

 <div>
 <label className="block text-xs font-mono uppercase adm-text-muted mb-1">Display Name</label>
 <input
 type="text"
 value={editingFeature.name}
 onChange={(e) => setEditingFeature({ ...editingFeature, name: e.target.value })}
 required
 className="w-full adm-surface border adm-divider rounded-xl px-4 py-2.5 adm-text-primary text-sm focus:outline-none focus:border-cyan-500"
 />
 </div>

 <div>
 <label className="block text-xs font-mono uppercase adm-text-muted mb-1">Description</label>
 <textarea
 value={editingFeature.description || ''}
 onChange={(e) => setEditingFeature({ ...editingFeature, description: e.target.value })}
 placeholder="Brief description of this feature capability..."
 rows={3}
 className="w-full adm-surface border adm-divider rounded-xl p-3 adm-text-primary text-xs focus:outline-none focus:border-cyan-500"
 />
 </div>

 <div className="flex justify-end gap-3 pt-4 border-t adm-divider">
 <button
 type="button"
 onClick={() => setEditingFeature(null)}
 className="px-4 py-2 rounded-xl text-xs font-semibold adm-surface adm-text-secondary hover:bg-[var(--adm-surface-hover)]"
 >
 Cancel
 </button>
 <button
 type="submit"
 disabled={saving}
 className="px-5 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-md disabled:opacity-50"
 >
 {saving ? 'Saving...' : 'Update Feature'}
 </button>
 </div>
 </form>
 </div>
 </div>
 )}
 </div>
 );
}
