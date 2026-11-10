'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { TermFeeOverviewResult } from '@/lib/fees';

export interface ClassLevelOption {
  id: string;
  name: string;
  studentCount?: number;
}

export interface TermOption {
  id: string;
  name: string;
  sessionLabel: string;
}

export interface FeeItemRecord {
  id: string;
  name: string;
  amount: number;
  classLevelId: string | null;
  classLevelName: string;
  createdAt: string;
}

export interface BankDetails {
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
}

export interface PastTermOption {
  id: string;
  name: string;
  sessionLabel: string;
  itemCount: number;
}

interface FeesAdminClientProps {
  slug: string;
  tenantName: string;
  activeTerm: TermOption | null;
  classLevels: ClassLevelOption[];
  initialOverview: TermFeeOverviewResult | null;
  initialFeeItems?: FeeItemRecord[];
  bankDetails?: BankDetails;
  pastTerms?: PastTermOption[];
}

const COMMON_FEE_PRESETS = [
  'Tuition Fee',
  'Sports & Games Levy',
  'Excursion & Field Trip',
  'School Bus / Transport',
  'Science Lab / Practical',
  'ICT & Computer Levy',
  'Books & Stationery',
  'Uniform & Sportswear',
  'Development Levy',
];

export default function FeesAdminClient({
  slug,
  tenantName,
  activeTerm,
  classLevels,
  initialOverview,
  initialFeeItems = [],
  bankDetails,
  pastTerms = [],
}: FeesAdminClientProps) {
  const [overview, setOverview] = useState<TermFeeOverviewResult | null>(initialOverview);
  const [feeItems, setFeeItems] = useState<FeeItemRecord[]>(initialFeeItems);
  const [selectedClassLevel, setSelectedClassLevel] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'partial' | 'unpaid' | 'no_fees'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'class_schedule' | 'items'>('overview');

  // New Fee Item Form state
  const [feeItemName, setFeeItemName] = useState('');
  const [feeItemAmount, setFeeItemAmount] = useState('');
  const [feeItemClassLevel, setFeeItemClassLevel] = useState<string>('all');
  const [isSubmittingItem, setIsSubmittingItem] = useState(false);
  const [itemSuccessMsg, setItemSuccessMsg] = useState('');
  const [itemErrorMsg, setItemErrorMsg] = useState('');

  // Edit Fee Item Modal state
  const [editingItem, setEditingItem] = useState<FeeItemRecord | null>(null);
  const [editName, setEditName] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editClassLevelId, setEditClassLevelId] = useState<string>('all');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editErrorMsg, setEditErrorMsg] = useState('');

  // Delete Fee Item confirmation state
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);

  // Manual Offline Payment Modal state
  const [recordingStudent, setRecordingStudent] = useState<{ id: string; name: string } | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'cash' | 'bank_transfer'>('cash');
  const [payRef, setPayRef] = useState('');
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);
  const [payError, setPayError] = useState('');

  // 1-Click Clone Fees from Previous Term
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [selectedSourceTermId, setSelectedSourceTermId] = useState<string>(pastTerms[0]?.id || '');
  const [copyPercentage, setCopyPercentage] = useState<string>('0');
  const [isSubmittingCopy, setIsSubmittingCopy] = useState(false);
  const [copySuccessMsg, setCopySuccessMsg] = useState('');
  const [copyErrorMsg, setCopyErrorMsg] = useState('');

  // Fee Adjustment / Discount / Waiver Modal state
  const [adjustingStudent, setAdjustingStudent] = useState<{ id: string; name: string; totalAssigned?: number } | null>(null);
  const [adjustFeeItemId, setAdjustFeeItemId] = useState<string>(feeItems[0]?.id || '');
  const [adjustType, setAdjustType] = useState<'discount' | 'waiver'>('discount');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [isSubmittingAdjust, setIsSubmittingAdjust] = useState(false);
  const [adjustError, setAdjustError] = useState('');

  // WhatsApp Reminder Modal state
  const [reminderStudent, setReminderStudent] = useState<{
    studentId: string;
    studentName: string;
    classLevelName: string | null;
    balanceRemaining: number;
  } | null>(null);
  const [copiedReminder, setCopiedReminder] = useState(false);

  if (!activeTerm) {
    return (
      <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-8 text-center">
        <h2 className="text-lg font-bold mb-2">No Active Academic Term</h2>
        <p className="text-sm">
          Please activate a term in Academic Settings before managing school fee ledgers.
        </p>
      </div>
    );
  }

  // Handle Create Fee Item
  const handleCreateFeeItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feeItemName || !feeItemAmount) return;

    setIsSubmittingItem(true);
    setItemSuccessMsg('');
    setItemErrorMsg('');

    try {
      const res = await fetch('/api/tenant/fees/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          termId: activeTerm.id,
          classLevelId: feeItemClassLevel === 'all' ? null : feeItemClassLevel,
          name: feeItemName.trim(),
          amount: parseFloat(feeItemAmount),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setItemErrorMsg(data.error || 'Failed to create fee item');
        return;
      }

      const created: FeeItemRecord = {
        id: data.feeItem.id,
        name: data.feeItem.name,
        amount: Number(data.feeItem.amount),
        classLevelId: data.feeItem.classLevelId,
        classLevelName: data.feeItem.classLevel?.name || 'All Classes',
        createdAt: data.feeItem.createdAt || new Date().toISOString(),
      };

      setFeeItems((prev) => [created, ...prev]);
      setFeeItemName('');
      setFeeItemAmount('');
      setFeeItemClassLevel('all');
      setItemSuccessMsg(`Fee item "${created.name}" configured successfully!`);
      setTimeout(() => setItemSuccessMsg(''), 4000);
    } catch (err: any) {
      setItemErrorMsg(err.message || 'Network error');
    } finally {
      setIsSubmittingItem(false);
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (item: FeeItemRecord) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditAmount(String(item.amount));
    setEditClassLevelId(item.classLevelId || 'all');
    setEditErrorMsg('');
  };

  // Submit Edit Fee Item
  const handleSubmitEditItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editName.trim() || !editAmount) return;

    setIsSubmittingEdit(true);
    setEditErrorMsg('');

    try {
      const res = await fetch('/api/tenant/fees/items', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingItem.id,
          name: editName.trim(),
          amount: parseFloat(editAmount),
          classLevelId: editClassLevelId === 'all' ? null : editClassLevelId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setEditErrorMsg(data.error || 'Failed to update fee item');
        return;
      }

      const updatedClass = classLevels.find((cl) => cl.id === editClassLevelId);
      const updatedRecord: FeeItemRecord = {
        ...editingItem,
        name: data.feeItem.name,
        amount: Number(data.feeItem.amount),
        classLevelId: data.feeItem.classLevelId,
        classLevelName: data.feeItem.classLevelId ? (updatedClass?.name || 'Specific Class') : 'All Classes',
      };

      setFeeItems((prev) => prev.map((item) => (item.id === editingItem.id ? updatedRecord : item)));
      setEditingItem(null);
    } catch (err: any) {
      setEditErrorMsg(err.message || 'Failed to update fee item');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Delete Fee Item
  const handleDeleteFeeItem = async (id: string) => {
    setIsDeletingItem(true);
    try {
      const res = await fetch(`/api/tenant/fees/items?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to delete fee item');
        return;
      }

      setFeeItems((prev) => prev.filter((item) => item.id !== id));
      setDeletingItemId(null);
    } catch (err: any) {
      alert(err.message || 'Network error deleting fee item');
    } finally {
      setIsDeletingItem(false);
    }
  };

  // Record Manual Offline Payment
  const handleRecordOfflinePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordingStudent || !payAmount) return;

    setIsSubmittingPay(true);
    setPayError('');

    try {
      const res = await fetch('/api/tenant/fees/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: recordingStudent.id,
          termId: activeTerm.id,
          amount: parseFloat(payAmount),
          method: payMethod,
          paymentRef: payRef || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setPayError(data.error || 'Failed to record payment');
        return;
      }

      setRecordingStudent(null);
      setPayAmount('');
      setPayRef('');
      window.location.reload();
    } catch (err: any) {
      setPayError(err.message || 'Network error');
    } finally {
      setIsSubmittingPay(false);
    }
  };

  // Handle Copy Fees from Previous Term
  const handleCopyFeeItems = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSourceTermId) return;

    setIsSubmittingCopy(true);
    setCopyErrorMsg('');
    setCopySuccessMsg('');

    try {
      const res = await fetch('/api/tenant/fees/items/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceTermId: selectedSourceTermId,
          targetTermId: activeTerm.id,
          percentageAdjustment: parseFloat(copyPercentage) || 0,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setCopyErrorMsg(data.error || 'Failed to copy fee items');
        return;
      }

      setCopySuccessMsg(data.message || `Copied ${data.copiedCount} fee items!`);
      setTimeout(() => {
        setIsCopyModalOpen(false);
        window.location.reload();
      }, 1200);
    } catch (err: any) {
      setCopyErrorMsg(err.message || 'Network error copying fee items');
    } finally {
      setIsSubmittingCopy(false);
    }
  };

  // Handle Grant Fee Adjustment (Discount / Waiver)
  const handleRecordAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingStudent || !adjustFeeItemId || !adjustAmount) return;

    setIsSubmittingAdjust(true);
    setAdjustError('');

    try {
      const res = await fetch('/api/tenant/fees/adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: adjustingStudent.id,
          feeItemId: adjustFeeItemId,
          adjustmentType: adjustType,
          amountOrPercent: parseFloat(adjustAmount),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setAdjustError(data.error || 'Failed to record fee adjustment');
        return;
      }

      setAdjustingStudent(null);
      setAdjustAmount('');
      window.location.reload();
    } catch (err: any) {
      setAdjustError(err.message || 'Network error');
    } finally {
      setIsSubmittingAdjust(false);
    }
  };

  // Export Debtors CSV
  const handleExportDebtorsCSV = () => {
    const debtors = (overview?.students || []).filter((s) => s.balanceRemaining > 0);
    if (debtors.length === 0) {
      alert('No students with outstanding balances found for this term.');
      return;
    }

    const headers = ['Student Name', 'Class Level', 'Total Assigned (NGN)', 'Adjustments (NGN)', 'Paid (NGN)', 'Balance Owed (NGN)', 'Status'];
    const rows = debtors.map((s) => [
      `"${s.studentName.replace(/"/g, '""')}"`,
      `"${(s.classLevelName || 'Unassigned').replace(/"/g, '""')}"`,
      s.totalAssigned,
      s.totalAdjustments,
      s.totalPaid,
      s.balanceRemaining,
      s.status.toUpperCase(),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const cleanFileName = `${tenantName.replace(/[^a-zA-Z0-9]/g, '_')}_Debtors_${activeTerm.sessionLabel}_${activeTerm.name}.csv`;
    link.setAttribute('download', cleanFileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // WhatsApp Reminder Text Generator
  const generateWhatsAppMessage = () => {
    if (!reminderStudent) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const paymentPortalUrl = `${origin}/${slug}/dashboard/fees/my-fees`;

    return `Dear Parent/Guardian of ${reminderStudent.studentName},

This is a gentle fee notification from *${tenantName}* for *${activeTerm.sessionLabel} • ${activeTerm.name}*.

• *Student:* ${reminderStudent.studentName}
• *Class:* ${reminderStudent.classLevelName || 'Unassigned'}
• *Outstanding Fee Balance:* ₦${reminderStudent.balanceRemaining.toLocaleString()}

${bankDetails?.bankName ? `*Official School Bank Details for Direct Transfer:*
• Bank: ${bankDetails.bankName}
• Account Number: ${bankDetails.bankAccountNumber || '—'}
• Account Name: ${bankDetails.bankAccountName || tenantName}` : ''}

You can also pay securely online with your debit card or view your digital receipt here:
${paymentPortalUrl}

Kindly notify the bursar's office or upload your payment receipt once completed. Thank you!`;
  };

  const handleCopyReminder = () => {
    const text = generateWhatsAppMessage();
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedReminder(true);
      setTimeout(() => setCopiedReminder(false), 3000);
    }
  };

  const handleOpenWhatsApp = () => {
    const text = generateWhatsAppMessage();
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const filteredStudents = (overview?.students || []).filter((s) => {
    const matchesClass = selectedClassLevel === 'all' || s.classLevelId === selectedClassLevel;
    const matchesStatus = filterStatus === 'all' || s.status === filterStatus;
    const matchesSearch =
      !searchQuery.trim() ||
      s.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      Boolean(s.classLevelName && s.classLevelName.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesClass && matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <span className="text-xs uppercase tracking-wider text-blue-600 font-bold block mb-1">
            {activeTerm.sessionLabel} • {activeTerm.name}
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            School Fee Ledger &amp; Collections
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Computed fee balances, offline payment reconciliation, and fee structure for {tenantName}.
          </p>
          {bankDetails?.bankName ? (
            <div className="mt-2.5 inline-flex items-center gap-2 px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
              <span className="font-bold text-slate-900">🏦 School Bank:</span>
              <span>{bankDetails.bankName}</span>
              <span className="font-mono font-semibold text-blue-700">{bankDetails.bankAccountNumber}</span>
              <span className="text-slate-500">({bankDetails.bankAccountName || tenantName})</span>
            </div>
          ) : (
            <p className="text-xs text-amber-700 mt-2 bg-amber-50 border border-amber-200 px-3 py-1 rounded-lg inline-block">
              ⚠️ Official bank details not yet configured. Set them in School Settings to show on receipts &amp; parent WhatsApp reminders.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Ledger Overview
          </button>
          <button
            onClick={() => setActiveTab('class_schedule')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'class_schedule'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Class Fee Schedule (All Classes)
          </button>
          <button
            onClick={() => setActiveTab('items')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'items'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Manage Fee Items ({feeItems.length})
          </button>

          <Link
            href={`/${slug}/dashboard/fees/verifications`}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-colors inline-flex items-center gap-1.5"
          >
            <span>🏦 Bank Verifications</span>
          </Link>
        </div>
      </div>

      {/* TAB 1: LEDGER OVERVIEW */}
      {activeTab === 'overview' && (
        <>
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs transition-shadow hover:shadow-sm">
              <span className="text-xs uppercase tracking-wider text-slate-500 font-bold block mb-1.5">
                Total Expected
              </span>
              <div className="text-xl sm:text-2xl xl:text-3xl font-extrabold text-slate-900 tabular-nums tracking-tight truncate" title={`₦${(overview?.totalExpected || 0).toLocaleString('en-NG')}`}>
                <span className="text-slate-400 font-bold text-lg sm:text-xl mr-1">₦</span>
                {(overview?.totalExpected || 0).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </div>
              <span className="text-xs text-slate-500 block mt-1.5 font-medium">
                {overview?.totalStudents || 0} Enrolled Students
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-emerald-200 bg-emerald-50/20 p-5 shadow-xs transition-shadow hover:shadow-sm">
              <span className="text-xs uppercase tracking-wider text-emerald-800 font-bold block mb-1.5">
                Total Collected
              </span>
              <div className="text-xl sm:text-2xl xl:text-3xl font-extrabold text-emerald-700 tabular-nums tracking-tight truncate" title={`₦${(overview?.totalCollected || 0).toLocaleString('en-NG')}`}>
                <span className="text-emerald-500/80 font-bold text-lg sm:text-xl mr-1">₦</span>
                {(overview?.totalCollected || 0).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </div>
              <span className="text-xs text-emerald-700 block mt-1.5 font-medium">
                {overview?.fullyPaidCount || 0} Paid • {overview?.partiallyPaidCount || 0} Partial
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-amber-200 bg-amber-50/20 p-5 shadow-xs transition-shadow hover:shadow-sm">
              <span className="text-xs uppercase tracking-wider text-amber-800 font-bold block mb-1.5">
                Total Outstanding
              </span>
              <div className="text-xl sm:text-2xl xl:text-3xl font-extrabold text-amber-700 tabular-nums tracking-tight truncate" title={`₦${(overview?.totalOutstanding || 0).toLocaleString('en-NG')}`}>
                <span className="text-amber-500/80 font-bold text-lg sm:text-xl mr-1">₦</span>
                {(overview?.totalOutstanding || 0).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </div>
              <span className="text-xs text-amber-700 block mt-1.5 font-medium">
                {overview?.unpaidCount || 0} Unpaid Students
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-purple-200 bg-purple-50/20 p-5 shadow-xs transition-shadow hover:shadow-sm">
              <span className="text-xs uppercase tracking-wider text-purple-800 font-bold block mb-1.5">
                Discounts &amp; Waivers
              </span>
              <div className="text-xl sm:text-2xl xl:text-3xl font-extrabold text-purple-700 tabular-nums tracking-tight truncate" title={`₦${(overview?.totalAdjustments || 0).toLocaleString('en-NG')}`}>
                <span className="text-purple-400 font-bold text-lg sm:text-xl mr-1">₦</span>
                {(overview?.totalAdjustments || 0).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </div>
              <span className="text-xs text-purple-700 block mt-1.5 font-medium">Student Adjustments</span>
            </div>
          </div>

          {/* Student Status Table with Search & Smart Actions */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="font-bold text-slate-900 text-lg">Student Fee Ledger Status</h2>
                <p className="text-xs text-slate-500">
                  Balances computed dynamically via payment ledger formula without cached drift.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Search Input */}
                <input
                  type="text"
                  placeholder="Search student or class..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
                />

                {/* Class Filter */}
                <select
                  value={selectedClassLevel}
                  onChange={(e) => setSelectedClassLevel(e.target.value)}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Class Levels</option>
                  {classLevels.map((cl) => (
                    <option key={cl.id} value={cl.id}>
                      {cl.name}
                    </option>
                  ))}
                </select>

                {/* Status Filter */}
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="all">All Payment Statuses ({overview?.totalStudents || 0})</option>
                  <option value="unpaid">Unpaid Debtors ({overview?.unpaidCount || 0})</option>
                  <option value="paid">Fully Paid ({overview?.fullyPaidCount || 0})</option>
                  <option value="partial">Partially Paid ({overview?.partiallyPaidCount || 0})</option>
                  <option value="no_fees">No Fees Assigned ({overview?.noFeesCount || 0})</option>
                </select>

                {/* Export Debtors CSV Button */}
                <button
                  type="button"
                  onClick={handleExportDebtorsCSV}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                  title="Export filtered debtors list as CSV spreadsheet"
                >
                  <span>📥 Export Debtors (CSV)</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3.5 whitespace-nowrap">Student Name</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">Class Level</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">Assigned</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">Adjustments</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">Paid</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">Balance Owed</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">Status</th>
                    <th className="px-5 py-3.5 whitespace-nowrap text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-slate-500 text-sm">
                        No student fee records found matching selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((s) => (
                      <tr key={s.studentId} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-3.5 font-bold text-slate-900 text-sm whitespace-nowrap">
                          {s.studentName}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap inline-block">
                            {s.classLevelName || 'Unassigned'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-sm tabular-nums whitespace-nowrap">
                          {s.totalAssigned > 0 ? (
                            <span className="font-semibold text-slate-900">₦ {s.totalAssigned.toLocaleString()}</span>
                          ) : (
                            <span className="font-normal text-slate-400">₦ 0</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-sm tabular-nums whitespace-nowrap">
                          {s.totalAdjustments > 0 ? (
                            <span className="font-semibold text-purple-700">-₦ {s.totalAdjustments.toLocaleString()}</span>
                          ) : (
                            <span className="text-slate-300 font-normal">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-sm tabular-nums whitespace-nowrap">
                          {s.totalPaid > 0 ? (
                            <span className="font-bold text-emerald-700">₦ {s.totalPaid.toLocaleString()}</span>
                          ) : (
                            <span className="font-normal text-slate-400">₦ 0</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-sm tabular-nums whitespace-nowrap">
                          {s.balanceRemaining > 0 ? (
                            <span className="font-bold text-amber-800">₦ {s.balanceRemaining.toLocaleString()}</span>
                          ) : (
                            <span className="font-normal text-slate-400">₦ 0</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          {s.status === 'paid' && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                              <span>✓</span> Fully Paid
                            </span>
                          )}
                          {s.status === 'partial' && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              Partial
                            </span>
                          )}
                          {s.status === 'unpaid' && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              Unpaid
                            </span>
                          )}
                          {s.status === 'no_fees' && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                              No Fees Assigned
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {s.balanceRemaining > 0 ? (
                              <>
                                {/* Record Offline Payment */}
                                <button
                                  onClick={() => setRecordingStudent({ id: s.studentId, name: s.studentName })}
                                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                                  title="Record cash or bank receipt"
                                >
                                  Record Payment
                                </button>

                                {/* Grant Discount / Waiver */}
                                <button
                                  onClick={() => {
                                    setAdjustingStudent({ id: s.studentId, name: s.studentName, totalAssigned: s.totalAssigned });
                                    setAdjustFeeItemId(feeItems[0]?.id || '');
                                    setAdjustAmount('');
                                    setAdjustError('');
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 transition-colors cursor-pointer whitespace-nowrap"
                                  title="Grant sibling discount, staff waiver, or scholarship"
                                >
                                  Waiver/Discount
                                </button>

                                {/* WhatsApp Fee Reminder (for debtors) */}
                                <button
                                  onClick={() => setReminderStudent(s)}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-colors cursor-pointer inline-flex items-center gap-1 whitespace-nowrap"
                                  title="Send pre-formatted WhatsApp fee reminder"
                                >
                                  <span>💬 Reminder</span>
                                </button>
                              </>
                            ) : s.totalAssigned > 0 ? (
                              <span className="px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200">
                                Settled ✓
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-400 bg-slate-50 border border-slate-200/80">
                                No Fees
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* TAB 2: CLASS FEE STRUCTURE (ALL CLASSES SCHEDULE) */}
      {activeTab === 'class_schedule' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs space-y-0">
          <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="font-bold text-slate-900 text-lg">Class Fee Structure &amp; Tariffs</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Displays official configured term fees across all class levels in the school, whether currently enrolled or vacant.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {pastTerms.length > 0 && (
                <button
                  onClick={() => setIsCopyModalOpen(true)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 transition-colors cursor-pointer shadow-2xs"
                >
                  ⚡ Copy from Prior Term
                </button>
              )}
              <button
                onClick={() => setActiveTab('items')}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer shadow-xs"
              >
                + Configure New Fee Item
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Class Level</th>
                  <th className="px-6 py-4">Enrolled Students</th>
                  <th className="px-6 py-4">Configured Fee Breakdown</th>
                  <th className="px-6 py-4">Total Term Fee</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {classLevels.map((cl) => {
                  const applicableItems = feeItems.filter(
                    (fi) => fi.classLevelId === null || fi.classLevelId === cl.id
                  );
                  const totalFeeForClass = applicableItems.reduce((sum, item) => sum + item.amount, 0);

                  return (
                    <tr key={cl.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-900 text-sm">{cl.name}</td>
                      <td className="px-6 py-4">
                        {(cl.studentCount || 0) > 0 ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            {cl.studentCount} {cl.studentCount === 1 ? 'Student' : 'Students'}
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                            0 Students
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {applicableItems.length === 0 ? (
                          <span className="text-xs text-slate-400 italic">No fee items assigned yet</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {applicableItems.map((fi) => (
                              <span
                                key={fi.id}
                                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                                  fi.classLevelId === null
                                    ? 'bg-blue-50/80 text-blue-800 border-blue-200'
                                    : 'bg-purple-50/80 text-purple-800 border-purple-200'
                                }`}
                              >
                                {fi.name} (₦ {fi.amount.toLocaleString()})
                                {fi.classLevelId === null && <span className="opacity-60 text-[10px] ml-1">[All]</span>}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-base font-extrabold tabular-nums text-slate-900">
                        ₦ {totalFeeForClass.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setFeeItemClassLevel(cl.id);
                              setActiveTab('items');
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
                          >
                            + Add Fee
                          </button>
                          {(cl.studentCount || 0) > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedClassLevel(cl.id);
                                setActiveTab('overview');
                              }}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                              View Ledger
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: MANAGE FEE ITEMS & TARIFFS */}
      {activeTab === 'items' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Create Fee Item Form Card */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Configure New Fee Item</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Add standard fees, excursions, or levies for {activeTerm.name}.
                </p>
              </div>
              {pastTerms.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsCopyModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 transition-colors cursor-pointer inline-flex items-center gap-1"
                >
                  <span>⚡ Clone Prior Term</span>
                </button>
              )}
            </div>

            {/* Quick Category Presets */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Quick Category Presets
              </label>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_FEE_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setFeeItemName(preset)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {itemSuccessMsg && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3.5 text-xs font-semibold">
                ✓ {itemSuccessMsg}
              </div>
            )}

            {itemErrorMsg && (
              <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3.5 text-xs font-semibold">
                {itemErrorMsg}
              </div>
            )}

            <form onSubmit={handleCreateFeeItem} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Fee Item Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Tuition Fee, Sports Levy, Science Lab"
                  value={feeItemName}
                  onChange={(e) => setFeeItemName(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Amount (₦) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 25000"
                  value={feeItemAmount}
                  onChange={(e) => setFeeItemAmount(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Class Level Scope *
                </label>
                <select
                  value={feeItemClassLevel}
                  onChange={(e) => setFeeItemClassLevel(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                >
                  <option value="all">Applies to All Class Levels (Global Fee)</option>
                  {classLevels.map((cl) => (
                    <option key={cl.id} value={cl.id}>
                      {cl.name} Only
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Choose "All Class Levels" for school-wide levies, or select a specific class for specialized fees (e.g. JSS 3 Excursion).
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmittingItem}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingItem ? 'Saving Fee Item...' : 'Add Fee Item to Term'}
              </button>
            </form>
          </div>

          {/* Directory of Active Fee Items */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-900 text-lg">Active Configured Fee Items ({feeItems.length})</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  All individual line items active for {activeTerm.name}.
                </p>
              </div>
              {pastTerms.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsCopyModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                >
                  Copy from Term...
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3.5">Fee Item Name</th>
                    <th className="px-5 py-3.5">Applicable Scope</th>
                    <th className="px-5 py-3.5">Amount</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {feeItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-500 text-sm space-y-3">
                        <p>No fee items configured for this term yet.</p>
                        {pastTerms.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setIsCopyModalOpen(true)}
                            className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer"
                          >
                            ⚡ Copy Fee Structure from Previous Term
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    feeItems.map((fi) => (
                      <tr key={fi.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-3.5 font-bold text-slate-900 text-sm">{fi.name}</td>
                        <td className="px-5 py-3.5">
                          {fi.classLevelId === null ? (
                            <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              All Classes
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                              {fi.classLevelName} Only
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 font-extrabold text-sm tabular-nums text-slate-900">
                          ₦ {fi.amount.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(fi)}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-blue-700 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 transition-colors cursor-pointer"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingItemId(fi.id)}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-700 hover:bg-rose-50 border border-slate-200 hover:border-rose-300 transition-colors cursor-pointer"
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: ⚡ COPY FEES FROM PREVIOUS TERM */}
      {isCopyModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-in fade-in duration-150">
            <div>
              <div className="flex items-center gap-2 text-amber-600 font-bold text-sm mb-1">
                <span>⚡ 1-Click Fee Setup</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900">Copy Fees from Previous Term</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Clones all configured fee items into <span className="font-semibold text-slate-900">{activeTerm.name}</span> so you don't have to re-enter them manually.
              </p>
            </div>

            {copySuccessMsg && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3 text-xs font-semibold">
                ✓ {copySuccessMsg}
              </div>
            )}

            {copyErrorMsg && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3 text-xs font-semibold">
                {copyErrorMsg}
              </div>
            )}

            <form onSubmit={handleCopyFeeItems} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Source Term to Copy From *
                </label>
                <select
                  value={selectedSourceTermId}
                  onChange={(e) => setSelectedSourceTermId(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                >
                  {pastTerms.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.sessionLabel} • {t.name} ({t.itemCount} items)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Price Adjustment (Inflation / Discount %)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="1"
                    placeholder="0"
                    value={copyPercentage}
                    onChange={(e) => setCopyPercentage(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none font-semibold"
                  />
                  <span className="text-xs font-bold text-slate-500">%</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Enter 0 for exact amounts, or a percentage increase/decrease (e.g. 10 for a +10% increment across all copied fees).
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCopyModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCopy}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {isSubmittingCopy ? 'Cloning Fee Items...' : 'Copy Fee Structure'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT FEE ITEM MODAL */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-in fade-in duration-150">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Edit Fee Item</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Update details for <span className="font-semibold text-slate-900">{editingItem.name}</span>.
              </p>
            </div>

            {editErrorMsg && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3 text-xs font-semibold">
                {editErrorMsg}
              </div>
            )}

            <form onSubmit={handleSubmitEditItem} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Fee Item Name *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Amount (₦) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Class Level Scope *
                </label>
                <select
                  value={editClassLevelId}
                  onChange={(e) => setEditClassLevelId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                >
                  <option value="all">Applies to All Class Levels</option>
                  {classLevels.map((cl) => (
                    <option key={cl.id} value={cl.id}>
                      {cl.name} Only
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {isSubmittingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: DELETE CONFIRMATION MODAL */}
      {deletingItemId && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-in fade-in duration-150">
            <h3 className="text-lg font-bold text-slate-900">Delete Fee Item?</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to remove this fee item? Student fee ledgers will be recalculated automatically.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeletingItemId(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteFeeItem(deletingItemId)}
                disabled={isDeletingItem}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {isDeletingItem ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: MANUAL OFFLINE PAYMENT MODAL */}
      {recordingStudent && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Record Offline Payment</h3>
            <p className="text-xs text-slate-500 mb-4">
              Recording payment for <span className="font-semibold text-slate-900">{recordingStudent.name}</span>.
              Attributed to logged-in Staff/Bursar.
            </p>

            {payError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3 text-xs mb-4 font-semibold">
                {payError}
              </div>
            )}

            <form onSubmit={handleRecordOfflinePayment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Amount Paid (₦) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 10000"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Payment Method
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as any)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                >
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Reference / Receipt No. (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. TR-98214"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRecordingStudent(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPay}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {isSubmittingPay ? 'Recording...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: 🎟️ GRANT FEE ADJUSTMENT (DISCOUNT / WAIVER) */}
      {adjustingStudent && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-in fade-in duration-150">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-purple-700 block mb-1">
                Scholarship &amp; Concession
              </span>
              <h3 className="text-lg font-bold text-slate-900">Grant Fee Waiver or Discount</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Apply a concession for <span className="font-semibold text-slate-900">{adjustingStudent.name}</span>. This reduces their computed balance immediately.
              </p>
            </div>

            {adjustError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3 text-xs font-semibold">
                {adjustError}
              </div>
            )}

            <form onSubmit={handleRecordAdjustment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Target Fee Item *
                </label>
                <select
                  value={adjustFeeItemId}
                  onChange={(e) => setAdjustFeeItemId(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                >
                  {feeItems.map((fi) => (
                    <option key={fi.id} value={fi.id}>
                      {fi.name} (₦ {fi.amount.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Concession Type *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType('discount')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                      adjustType === 'discount'
                        ? 'bg-purple-100 border-purple-300 text-purple-900'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Sibling / Merit Discount
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('waiver')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                      adjustType === 'waiver'
                        ? 'bg-purple-100 border-purple-300 text-purple-900'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Staff / Full Waiver
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Adjustment Amount (₦) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 5000"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none font-semibold"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustingStudent(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdjust}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold bg-purple-700 hover:bg-purple-800 text-white transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {isSubmittingAdjust ? 'Applying Concession...' : 'Apply Concession'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: 💬 WHATSAPP FEE REMINDER */}
      {reminderStudent && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-in fade-in duration-150">
            <div>
              <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm mb-1">
                <span>💬 WhatsApp Fee Debt Reminder</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Send Fee Notice for {reminderStudent.studentName}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Review the polite, pre-formatted message below with balance and school payment details.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
              {generateWhatsAppMessage()}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleCopyReminder}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
              >
                {copiedReminder ? '✓ Copied to Clipboard!' : '📋 Copy Text'}
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setReminderStudent(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleOpenWhatsApp}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                >
                  <span>🚀 Open WhatsApp</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
