'use client';

import { useState } from 'react';

interface ExportClientProps {
  slug: string;
  tenantName: string;
  tenantId: string;
}

export function ExportClient({ slug, tenantName, tenantId }: ExportClientProps) {
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = (format: 'json' | 'csv', type: 'full' | 'students' | 'results' | 'fees') => {
    const key = `${format}-${type}`;
    setDownloading(key);

    const url = `/api/tenant/export?slug=${encodeURIComponent(slug)}&tenantId=${encodeURIComponent(tenantId)}&format=${format}&type=${type}`;
    
    // Create temporary link element to trigger browser download
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', '');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      setDownloading(null);
    }, 1500);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-1">
          Data Export &amp; Backup Control
        </h1>
        <p className="text-slate-500 text-sm">
          Export your school&apos;s complete data records for <strong className="text-slate-700">{tenantName}</strong> in structured JSON or spreadsheet CSV format. Meets NDPR data portability requirements.
        </p>
      </div>

      {/* Primary JSON Full Archive Export Card */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl p-6 shadow-md border border-slate-700">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <span className="inline-block bg-blue-500/20 text-blue-300 border border-blue-500/40 text-xs font-mono px-2.5 py-0.5 rounded font-semibold uppercase tracking-wider">
              NDPR Compliant Full Archive
            </span>
            <h2 className="text-xl font-bold text-white">Full Tenant JSON Archive Dump</h2>
            <p className="text-slate-300 text-sm max-w-2xl">
              Downloads a complete, un-truncated JSON file containing all school records: student profiles, enrollments, staff lists, academic broadsheets, result PINs, fee items, fee payments, adjustments, and attendance history.
            </p>
          </div>

          <button
            onClick={() => handleDownload('json', 'full')}
            disabled={downloading === 'json-full'}
            className="shrink-0 px-5 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2 cursor-pointer"
          >
            {downloading === 'json-full' ? 'Preparing JSON...' : 'Download Full JSON Archive'}
          </button>
        </div>
      </div>

      {/* CSV Spreadsheet Exports Grid */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-4 tracking-tight">Spreadsheet Exports (CSV Format)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Students CSV Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between shadow-xs hover:border-slate-300 transition-all">
            <div>
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg mb-3 border border-emerald-100">
                
              </div>
              <h3 className="font-bold text-slate-900 text-base mb-1">Student Roster</h3>
              <p className="text-slate-500 text-xs leading-relaxed">
                Export all student profiles, class level assignments, enrollment status, and guardian contact details.
              </p>
            </div>
            <button
              onClick={() => handleDownload('csv', 'students')}
              disabled={downloading === 'csv-students'}
              className="mt-6 w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {downloading === 'csv-students' ? 'Exporting...' : 'Download Students CSV'}
            </button>
          </div>

          {/* Results CSV Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between shadow-xs hover:border-slate-300 transition-all">
            <div>
              <div className="w-10 h-10 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center font-bold text-lg mb-3 border border-cyan-100">
                
              </div>
              <h3 className="font-bold text-slate-900 text-base mb-1">Academic Results Broadsheet</h3>
              <p className="text-slate-500 text-xs leading-relaxed">
                Export subject score entries, CA assessments, examination scores, grades, and comments across all terms.
              </p>
            </div>
            <button
              onClick={() => handleDownload('csv', 'results')}
              disabled={downloading === 'csv-results'}
              className="mt-6 w-full py-2.5 px-4 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {downloading === 'csv-results' ? 'Exporting...' : 'Download Results CSV'}
            </button>
          </div>

          {/* Fees CSV Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between shadow-xs hover:border-slate-300 transition-all">
            <div>
              <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-lg mb-3 border border-amber-100">
                
              </div>
              <h3 className="font-bold text-slate-900 text-base mb-1">Fee Payments &amp; Transactions</h3>
              <p className="text-slate-500 text-xs leading-relaxed">
                Export complete payment records, payment methods, transaction reference IDs, and payment timestamps.
              </p>
            </div>
            <button
              onClick={() => handleDownload('csv', 'fees')}
              disabled={downloading === 'csv-fees'}
              className="mt-6 w-full py-2.5 px-4 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {downloading === 'csv-fees' ? 'Exporting...' : 'Download Fees CSV'}
            </button>
          </div>
        </div>
      </div>

      {/* Security & Data Ownership Notice */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-xs text-slate-600 space-y-1.5">
        <div className="font-bold text-slate-800 flex items-center gap-1.5">
           Data Portability &amp; No Vendor Lock-In Guarantee
        </div>
        <p>
          Your school owns 100% of its data. You can perform full data exports at any time without fees, restrictions, or operational delays.
        </p>
      </div>
    </div>
  );
}
