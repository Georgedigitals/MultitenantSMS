import React from 'react';
import { redirect, notFound } from 'next/navigation';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { getTenantDb } from '@/lib/tenant-db';
import DashboardNav from '@/components/dashboard-nav';
import { DeleteStaffButton } from './delete-staff-button';
import { AddStaffModal } from './add-staff-modal';
import { EditStaffModal } from './edit-staff-modal';
import { CsvExportButton } from '@/components/csv-export-button';
import { CsvImportModal } from '@/components/csv-import-modal';

interface StaffPageProps {
  params: Promise<{ slug: string }>;
}

export default async function StaffPage({ params }: StaffPageProps) {
  const { slug } = await params;

  const tenant = await getTenantContext({ slug });
  if (!tenant) notFound();

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) redirect('/login');
  if (auth.user.role !== 'school_admin') redirect('/dashboard');

  const db = getTenantDb(tenant.id);
  const currentSession = tenant.currentSession;

  const staffListRaw = await db.staff.findMany({
    include: {
      userAccount: {
        select: { username: true, role: true, isActive: true },
      },
      ...(currentSession
        ? {
            teachingAssignments: {
              where: { sessionId: currentSession.id },
              include: { classLevel: true, subject: true },
            },
            formTeacherAssignments: {
              where: { sessionId: currentSession.id },
              include: { classLevel: true },
            },
          }
        : {}),
    },
    orderBy: { name: 'asc' },
  }).catch(() => []);

  const staffList = staffListRaw;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <DashboardNav slug={slug} role={auth.user.role} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Staff Directory</h1>
          <p className="text-sm text-slate-500">
            {staffList.length} Staff Members Registered • Active Session: {currentSession?.label || 'None'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <CsvExportButton
            filename={`${slug}-staff-roster`}
            headers={['Staff ID', 'Full Name', 'Role Base', 'Phone', 'Email', 'Active User Account']}
            rows={staffList.map((st: any) => [
              st.id,
              st.name,
              st.roleBase,
              st.contactInfo?.phone || '',
              st.contactInfo?.email || '',
              st.userAccount?.isActive ? 'Active' : 'No Account',
            ])}
            label="Export Staff (CSV)"
          />
          {auth.user.role === 'school_admin' && (
            <>
              <CsvImportModal
                slug={slug}
                entityName="Staff"
                importEndpoint="/api/tenant/staff/import"
                payloadKey="staff"
                sampleHeaders={['Staff Name', 'Role', 'Phone', 'Email']}
                sampleRows={[
                  ['Adeola Adebayo', 'teacher', '+2348039991122', 'adeola.adebayo@example.com'],
                  ['Dr. Chukwuma Obi', 'principal', '+2348021112233', 'c.obi@example.com'],
                  ['Mrs. Ngozi Eze', 'bursar', '+2348054445566', 'ngozi.bursar@example.com'],
                ]}
                fieldMapping={{
                  'Staff Name': 'name',
                  'staff name': 'name',
                  'name': 'name',
                  'Role': 'role',
                  'role': 'role',
                  'Role Base': 'role',
                  'Phone': 'phone',
                  'phone': 'phone',
                  'Email': 'email',
                  'email': 'email',
                }}
                buttonLabel="Import Staff (CSV)"
              />
              <AddStaffModal slug={slug} />
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="px-6 py-3.5">Staff Name</th>
              <th className="px-6 py-3.5">Role</th>
              <th className="px-6 py-3.5">Form Teacher Role</th>
              <th className="px-6 py-3.5">Subject Assignments</th>
              <th className="px-6 py-3.5">Contact</th>
              {auth.user.role === 'school_admin' && <th className="px-6 py-3.5 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {staffList.length === 0 ? (
              <tr>
                <td colSpan={auth.user.role === 'school_admin' ? 6 : 5} className="px-6 py-12 text-center text-slate-400 text-sm">
                  No staff members found.
                </td>
              </tr>
            ) : (
              staffList.map((st: any) => {
                const contact = st.contactInfo as any;
                const formClass = st.formTeacherAssignments?.[0]?.classLevel?.name;
                const teachings = st.teachingAssignments || [];

                return (
                  <tr key={st.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{st.name}</div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] font-mono text-slate-500">
                        <span className="font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          ID: {st.staffCode || `STF-${st.id.slice(-4).toUpperCase()}`}
                        </span>
                        <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 font-semibold">
                          PIN: {st.attendancePin || '1234'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-slate-100 text-slate-700">
                        {st.roleBase}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {formClass ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Form Teacher: {formClass}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">None</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {teachings.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-md">
                          {teachings.map((ta: any) => (
                            <span
                              key={ta.id}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700 border border-blue-100"
                            >
                              {ta.subject.name} ({ta.classLevel.name})
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">No subject assignments</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      <div>
                        {st.userAccount?.username || contact?.email ? (
                          <div className="font-medium text-slate-800 font-mono text-[11px]">{st.userAccount?.username || contact?.email}</div>
                        ) : null}
                        {contact?.phone && <div className="text-slate-400 text-[11px] mt-0.5">{contact.phone}</div>}
                        {!contact?.email && !contact?.phone && !st.userAccount?.username && '—'}
                      </div>
                    </td>
                    {auth.user.role === 'school_admin' && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <EditStaffModal
                            slug={slug}
                            staff={{
                              id: st.id,
                              name: st.name,
                              roleBase: st.roleBase,
                              staffCode: st.staffCode || `STF-${st.id.slice(-4).toUpperCase()}`,
                              attendancePin: st.attendancePin || '1234',
                              contactInfo: contact,
                            }}
                          />
                          <DeleteStaffButton
                            slug={slug}
                            staffId={st.id}
                            staffName={st.name}
                          />
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
