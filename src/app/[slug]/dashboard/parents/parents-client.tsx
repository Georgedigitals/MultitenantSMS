'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { CsvImportModal } from '@/components/csv-import-modal';
import { AddParentModal, EditParentModal, ManageWardsModal, StudentOption } from '@/components/parent-modals';
import { ResetStudentPinModal } from '@/app/[slug]/dashboard/students/reset-student-pin-modal';

interface WardItem {
  id: string;
  name: string;
  classLevel: string;
}

interface ParentItem {
  id?: string;
  key: string;
  name: string;
  relationship: string;
  phone: string;
  email: string;
  address: string;
  wards: WardItem[];
  hasPortalAccount: boolean;
}

interface ClassLevelItem {
  id: string;
  name: string;
}

interface ParentsClientProps {
  slug: string;
  parents: ParentItem[];
  classLevels: ClassLevelItem[];
  totalStudents: number;
  allStudents?: StudentOption[];
}

export default function ParentsClient({
  slug,
  parents,
  classLevels,
  totalStudents,
  allStudents = [],
}: ParentsClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Copy phone/email helper
  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Filtered Parents
  const filteredParents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return parents.filter((p) => {
      // Class filter
      if (selectedClass !== 'all') {
        const matchesClass = p.wards.some(
          (w) => w.classLevel.toLowerCase() === selectedClass.toLowerCase()
        );
        if (!matchesClass) return false;
      }

      // Search filter
      if (!q) return true;
      const nameMatch = p.name.toLowerCase().includes(q);
      const phoneMatch = p.phone.toLowerCase().includes(q);
      const emailMatch = p.email.toLowerCase().includes(q);
      const wardMatch = p.wards.some((w) => w.name.toLowerCase().includes(q));

      return nameMatch || phoneMatch || emailMatch || wardMatch;
    });
  }, [parents, searchQuery, selectedClass]);

  // Metric counts
  const totalParents = parents.length;
  const withPhone = parents.filter((p) => p.phone.trim().length >= 7).length;
  const withPortal = parents.filter((p) => p.hasPortalAccount).length;

  // Export to CSV for PTA
  const handleExportCSV = () => {
    if (filteredParents.length === 0) return;

    const headers = ['Parent/Guardian Name', 'Relationship', 'Phone', 'Email', 'Address', 'Linked Wards & Classes', 'Portal Account'];
    const rows = filteredParents.map((p) => [
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.relationship.replace(/"/g, '""')}"`,
      `"${p.phone.replace(/"/g, '""')}"`,
      `"${p.email.replace(/"/g, '""')}"`,
      `"${p.address.replace(/"/g, '""')}"`,
      `"${p.wards.map((w) => `${w.name} (${w.classLevel})`).join('; ')}"`,
      p.hasPortalAccount ? 'Active' : 'Not Activated',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${slug}-parents-pta-directory.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Clean phone number for WhatsApp
  const cleanPhoneForWhatsApp = (phone: string) => {
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('0') && clean.length === 11) {
      clean = '234' + clean.slice(1);
    }
    return clean;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </span>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Parents & Guardians Directory</h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Centralized PTA directory with linked student wards, contact information, and one-click communication channels.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export PTA Register (CSV)
          </button>
          <CsvImportModal
            slug={slug}
            entityName="Parents"
            importEndpoint="/api/tenant/parents/import"
            payloadKey="parents"
            sampleHeaders={['Parent Name', 'Relationship', 'Phone', 'Email', 'Address', 'Student Name']}
            sampleRows={[
              ['Chief Emeka Okonkwo', 'Father', '+2348031234567', 'emeka.okonkwo@example.com', '12 Marina Road, Lagos', 'Chinedu Okonkwo'],
              ['Hajiya Fatima Bello', 'Mother', '+2348029876543', 'fatima.bello@example.com', '5 Kano Crescent, Abuja', 'Amina Bello'],
            ]}
            fieldMapping={{
              'Parent Name': 'guardianName',
              'parent name': 'guardianName',
              'name': 'guardianName',
              'Relationship': 'relationship',
              'relationship': 'relationship',
              'Phone': 'phone',
              'phone': 'phone',
              'Email': 'email',
              'email': 'email',
              'Address': 'address',
              'address': 'address',
              'Student Name': 'studentName',
              'student name': 'studentName',
              'ward': 'studentName',
            }}
            buttonLabel="Import Parents (CSV)"
          />
          <AddParentModal
            slug={slug}
            allStudents={allStudents}
          />
        </div>
      </div>

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Parents</span>
          <div className="text-2xl font-black text-slate-900">{totalParents.toLocaleString()}</div>
          <p className="text-[11px] text-slate-500">Unique registered guardians</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Linked Students</span>
          <div className="text-2xl font-black text-blue-600">{totalStudents.toLocaleString()}</div>
          <p className="text-[11px] text-slate-500">Enrolled wards in school</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Contactable via Phone/SMS</span>
          <div className="text-2xl font-black text-emerald-600">{withPhone.toLocaleString()}</div>
          <p className="text-[11px] text-slate-500">{totalParents > 0 ? Math.round((withPhone / totalParents) * 100) : 0}% with valid phone number</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Portal Logins Active</span>
          <div className="text-2xl font-black text-indigo-600">{withPortal.toLocaleString()}</div>
          <p className="text-[11px] text-slate-500">Parents with portal access</p>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-96">
          <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by parent name, phone, email, or student ward..."
            className="w-full pl-10 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-xs font-semibold text-slate-500 whitespace-nowrap">Filter Class:</label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          >
            <option value="all">All Classes</option>
            {classLevels.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
          <span className="text-xs text-slate-400 font-semibold px-2">
            Showing {filteredParents.length} of {parents.length}
          </span>
        </div>
      </div>

      {/* Parents Directory Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {filteredParents.length === 0 ? (
          <div className="text-center py-16 px-4 space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-900">No parent records found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery || selectedClass !== 'all'
                ? 'Try adjusting your search query or class filter to find the parent.'
                : 'Parents will automatically appear here as students are enrolled with guardian information.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Parent / Guardian</th>
                  <th className="py-3.5 px-4">Contact Phone</th>
                  <th className="py-3.5 px-4">Email Address</th>
                  <th className="py-3.5 px-4">Linked Student Wards</th>
                  <th className="py-3.5 px-4">Portal Login</th>
                  <th className="py-3.5 px-4 text-right">Quick Contact Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredParents.map((parent) => {
                  const cleanedWhatsApp = cleanPhoneForWhatsApp(parent.phone);
                  const isCopiedPhone = copiedKey === `phone_${parent.key}`;
                  const isCopiedEmail = copiedKey === `email_${parent.key}`;

                  return (
                    <tr key={parent.key} className="hover:bg-slate-50/70 transition-colors">
                      {/* Name & Relationship */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-black flex items-center justify-center text-xs shrink-0">
                            {parent.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block leading-tight">{parent.name}</span>
                            <span className="inline-block mt-0.5 px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-600 rounded">
                              {parent.relationship}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Phone Number */}
                      <td className="py-3 px-4">
                        {parent.phone ? (
                          <div className="flex items-center gap-1.5 font-mono text-slate-700">
                            <span>{parent.phone}</span>
                            <button
                              onClick={() => handleCopy(parent.phone, `phone_${parent.key}`)}
                              className="text-slate-400 hover:text-slate-700 p-1 rounded"
                              title="Copy Phone Number"
                            >
                              {isCopiedPhone ? (
                                <span className="text-[10px] font-sans font-bold text-emerald-600">Copied!</span>
                              ) : (
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No phone provided</span>
                        )}
                      </td>

                      {/* Email */}
                      <td className="py-3 px-4">
                        {parent.email ? (
                          <div className="flex items-center gap-1.5 text-slate-700">
                            <span className="truncate max-w-[180px]">{parent.email}</span>
                            <button
                              onClick={() => handleCopy(parent.email, `email_${parent.key}`)}
                              className="text-slate-400 hover:text-slate-700 p-1 rounded shrink-0"
                              title="Copy Email"
                            >
                              {isCopiedEmail ? (
                                <span className="text-[10px] font-bold text-emerald-600">Copied!</span>
                              ) : (
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No email</span>
                        )}
                      </td>

                      {/* Linked Wards */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1.5 max-w-xs">
                          <div className="flex flex-wrap gap-1.5">
                            {parent.wards.length === 0 ? (
                              <span className="text-[11px] text-slate-400 italic">No linked wards</span>
                            ) : (
                              parent.wards.map((ward) => (
                                <span
                                  key={ward.id}
                                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200/80 text-[11px] font-semibold text-blue-800"
                                >
                                  <span>{ward.name}</span>
                                  <span className="text-[10px] font-medium text-blue-500">({ward.classLevel})</span>
                                  <ResetStudentPinModal
                                    slug={slug}
                                    studentId={ward.id}
                                    studentName={ward.name}
                                    buttonClassName="p-0.5 text-blue-600 hover:text-amber-600 hover:bg-amber-100/80 rounded transition-colors"
                                  />
                                </span>
                              ))
                            )}
                          </div>
                          {parent.id && (
                            <div className="pt-0.5">
                              <ManageWardsModal
                                slug={slug}
                                guardianId={parent.id}
                                parentName={parent.name}
                                currentWards={parent.wards}
                                allStudents={allStudents}
                              />
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Portal Login Status */}
                      <td className="py-3 px-4">
                        {parent.hasPortalAccount ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Active Account
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                            No Portal Login
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {parent.id && (
                            <EditParentModal
                              slug={slug}
                              guardian={{
                                id: parent.id,
                                name: parent.name,
                                relationship: parent.relationship,
                                phone: parent.phone,
                                email: parent.email,
                                address: parent.address,
                              }}
                            />
                          )}

                          {/* WhatsApp */}
                          {cleanedWhatsApp ? (
                            <a
                              href={`https://wa.me/${cleanedWhatsApp}?text=${encodeURIComponent(`Hello ${parent.name}, this is from ${slug.replace(/-/g, ' ').toUpperCase()} regarding your ward.`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                              title="Chat on WhatsApp"
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                              </svg>
                            </a>
                          ) : null}

                          {/* SMS */}
                          {parent.phone ? (
                            <Link
                              href={`/dashboard/sms?recipient=${encodeURIComponent(parent.phone)}`}
                              className="p-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                              title="Send SMS"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                              </svg>
                            </Link>
                          ) : null}

                          {/* Email */}
                          {parent.email ? (
                            <a
                              href={`mailto:${parent.email}?subject=${encodeURIComponent(`Official School Notice: ${slug.replace(/-/g, ' ').toUpperCase()}`)}`}
                              className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                              title="Send Email"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                            </a>
                          ) : null}

                          {/* In-App Message */}
                          <Link
                            href={`/dashboard/messages?recipient=${encodeURIComponent(parent.key)}`}
                            className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
                            title="In-App Message"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                            </svg>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
