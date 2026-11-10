'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

export interface CsvImportModalProps {
  slug: string;
  entityName: string; // e.g. 'Students', 'Staff', 'Subjects', 'Parents'
  importEndpoint: string;
  payloadKey: string; // e.g. 'students', 'staff', 'subjects', 'parents'
  sampleHeaders: string[];
  sampleRows: string[][];
  fieldMapping: Record<string, string>; // CSV Header -> Payload key
  buttonLabel?: string;
  onSuccess?: () => void;
}

export function CsvImportModal({
  slug,
  entityName,
  importEndpoint,
  payloadKey,
  sampleHeaders,
  sampleRows,
  fieldMapping,
  buttonLabel,
  onSuccess,
}: CsvImportModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Generate and download sample CSV in browser
  const handleDownloadTemplate = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [sampleHeaders.join(','), ...sampleRows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(','))].join(
        '\n'
      );
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${slug}-${entityName.toLowerCase()}-sample-template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Basic robust CSV line parser handling quotes
  const parseCSV = (text: string) => {
    const lines: string[] = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if ((c === '\n' || c === '\r') && !inQuotes) {
        if (cur.trim()) lines.push(cur);
        cur = '';
        if (c === '\r' && text[i + 1] === '\n') i++;
      } else {
        cur += c;
      }
    }
    if (cur.trim()) lines.push(cur);

    if (lines.length === 0) return { headers: [], rows: [] };

    const parseLine = (line: string): string[] => {
      const cells: string[] = [];
      let cell = '';
      let inside = false;
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inside = !inside;
        } else if (char === ',' && !inside) {
          cells.push(cell.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
          cell = '';
        } else {
          cell += char;
        }
      }
      cells.push(cell.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
      return cells;
    };

    const headers = parseLine(lines[0]);
    const rows = lines.slice(1).map(parseLine);
    return { headers, rows };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const { headers, rows } = parseCSV(content);

        if (rows.length === 0) {
          setErrorMsg('The selected CSV file has headers but contains no data rows.');
          return;
        }

        setRawHeaders(headers);

        // Normalize header mapping
        const mappedRows = rows
          .map((row) => {
            const item: Record<string, string> = {};
            headers.forEach((h, idx) => {
              const cleanHeader = h.trim();
              const targetKey = fieldMapping[cleanHeader] || fieldMapping[cleanHeader.toLowerCase()] || cleanHeader;
              item[targetKey] = row[idx] || '';
            });
            return item;
          })
          .filter((item) => Object.values(item).some((v) => Boolean(v)));

        setParsedData(mappedRows);
        setPreviewRows(mappedRows.slice(0, 5));
      } catch (err: any) {
        setErrorMsg('Failed to parse CSV file: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleSubmitImport = async () => {
    if (parsedData.length === 0) {
      setErrorMsg('No parsed records ready to import.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`${importEndpoint}?slug=${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [payloadKey]: parsedData }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to import records');
        setIsProcessing(false);
        return;
      }

      setSuccessMsg(`Successfully imported ${data.importedCount} of ${data.totalRows} records!`);
      setIsProcessing(false);
      setParsedData([]);
      setFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      if (onSuccess) {
        onSuccess();
      } else {
        setTimeout(() => {
          setIsOpen(false);
          router.refresh();
        }, 1200);
      }
    } catch (err: any) {
      setErrorMsg('Network error while uploading data: ' + err.message);
      setIsProcessing(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setErrorMsg(null);
          setSuccessMsg(null);
          setParsedData([]);
          setFileName(null);
          setIsOpen(true);
        }}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
      >
        <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        <span>{buttonLabel || `Import ${entityName} (CSV)`}</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Import {entityName} via CSV</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Upload spreadsheet records to bulk create or update {entityName.toLowerCase()}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                ×
              </button>
            </div>

            <div className="py-4 space-y-4">
              {/* Template Download Step */}
              <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="p-1.5 bg-blue-600 text-white rounded-lg">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-blue-950">Standard CSV Format Template</h4>
                    <p className="text-[11px] text-blue-700">Pre-formatted headers for easy spreadsheet population.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="px-3 py-1.5 text-xs font-bold bg-white text-blue-700 hover:bg-blue-100/60 border border-blue-300 rounded-lg shadow-2xs shrink-0 cursor-pointer"
                >
                  Download Sample Template
                </button>
              </div>

              {/* Error & Success Messages */}
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                  {errorMsg}
                </div>
              )}
              {successMsg && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                  <span>✓</span>
                  <span>{successMsg}</span>
                </div>
              )}

              {/* File Upload Drop Area */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Select CSV Spreadsheet File
                </label>
                <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-6 text-center bg-slate-50 transition-colors cursor-pointer relative">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="space-y-1">
                    <svg className="w-8 h-8 mx-auto text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <div className="text-xs font-semibold text-slate-700">
                      {fileName ? <span className="text-blue-600 font-bold">{fileName}</span> : 'Click or drag a CSV file here to upload'}
                    </div>
                    <p className="text-[10px] text-slate-400">File format: .csv (UTF-8 encoded)</p>
                  </div>
                </div>
              </div>

              {/* Live Preview of Parsed Rows */}
              {parsedData.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>Detected {parsedData.length} records to import</span>
                    <span className="text-[10px] text-slate-400">Previewing first {previewRows.length} rows</span>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="min-w-full text-left text-xs divide-y divide-slate-200">
                      <thead className="bg-slate-100 text-[10px] font-mono uppercase text-slate-600">
                        <tr>
                          {Object.keys(previewRows[0] || {}).map((k) => (
                            <th key={k} className="px-3 py-2">
                              {k}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {previewRows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            {Object.values(row).map((val: any, cidx) => (
                              <td key={cidx} className="px-3 py-2 truncate max-w-[150px]">
                                {String(val) || '—'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={parsedData.length === 0 || isProcessing}
                onClick={handleSubmitImport}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <svg className="animate-spin w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Importing {parsedData.length} Records...</span>
                  </>
                ) : (
                  <span>Confirm &amp; Import ({parsedData.length})</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
