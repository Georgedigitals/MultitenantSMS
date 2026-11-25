import React from 'react';
import { redirect, notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { getTenantDb } from '@/lib/tenant-db';
import { getTenantClassLevels } from '@/lib/class-levels';
import DashboardNav from '@/components/dashboard-nav';
import { AssignFormTeacherModal } from './assign-form-teacher-modal';
import { AssignSubjectTeacherModal } from './assign-subject-teacher-modal';
import { DeleteAssignmentButton } from './delete-assignment-button';

interface AssignmentsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function AssignmentsPage({ params }: AssignmentsPageProps) {
  const { slug } = await params;

  const tenant = await getTenantContext({ slug });
  if (!tenant) notFound();

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) redirect('/login');
  if (!['school_admin', 'teacher'].includes(auth.user.role)) redirect('/dashboard');

  const db = getTenantDb(tenant.id);
  const currentSession = tenant.currentSession;

  // Tenant-scoped class levels (custom or legacy range)
  const usableLevels = await getTenantClassLevels(tenant.id, { filterLegacyByRange: true });

  const isTeacher = auth.user.role === 'teacher';

  const [allTenantStaff, allTenantSubjects] = await Promise.all([
    !isTeacher ? db.staff.findMany({ orderBy: { name: 'asc' } }).catch(() => []) : [],
    db.subject.findMany({ orderBy: { name: 'asc' } }).catch(() => []),
  ]);

  let formTeacherAssignments: any[] = [];
  let teachingAssignments: any[] = [];

  if (currentSession) {
    const rawForm = await db.formTeacherAssignment.findMany({
      where: {
        sessionId: currentSession.id,
        ...(isTeacher && auth.user.staffId ? { staffId: auth.user.staffId } : {}),
      },
    });

    const rawTeaching = await db.teachingAssignment.findMany({
      where: {
        sessionId: currentSession.id,
        ...(isTeacher && auth.user.staffId ? { staffId: auth.user.staffId } : {}),
      },
    });

    const staffIds = Array.from(new Set([
      ...rawForm.map((a: any) => a.staffId),
      ...rawTeaching.map((a: any) => a.staffId),
    ])).filter(Boolean);

    const classLevelIds = Array.from(new Set([
      ...rawForm.map((a: any) => a.classLevelId),
      ...rawTeaching.map((a: any) => a.classLevelId),
    ])).filter(Boolean);

    const subjectIds = Array.from(new Set(rawTeaching.map((a: any) => a.subjectId))).filter(Boolean);

    const [staffList, classLevelsList, subjectsList] = await Promise.all([
      staffIds.length > 0 ? db.staff.findMany({ where: { id: { in: staffIds } } }) : [],
      classLevelIds.length > 0 ? prisma.classLevel.findMany({ where: { id: { in: classLevelIds } } }) : [],
      subjectIds.length > 0 ? db.subject.findMany({ where: { id: { in: subjectIds } } }) : [],
    ]);

    const staffMap = new Map(staffList.map((s: any) => [s.id, s]));
    const classLevelMap = new Map(classLevelsList.map((c: any) => [c.id, c]));
    const subjectMap = new Map(subjectsList.map((sb: any) => [sb.id, sb]));

    formTeacherAssignments = rawForm.map((a: any) => ({
      ...a,
      staff: staffMap.get(a.staffId) || { name: 'Unknown', roleBase: 'staff' },
      classLevel: classLevelMap.get(a.classLevelId) || { name: 'Unknown', orderIndex: 0 },
    })).sort((a: any, b: any) => (a.classLevel.orderIndex || 0) - (b.classLevel.orderIndex || 0));

    teachingAssignments = rawTeaching.map((a: any) => ({
      ...a,
      staff: staffMap.get(a.staffId) || { name: 'Unknown' },
      classLevel: classLevelMap.get(a.classLevelId) || { name: 'Unknown', orderIndex: 0 },
      subject: subjectMap.get(a.subjectId) || { name: 'Unknown' },
    })).sort((a: any, b: any) => {
      const classDiff = (a.classLevel.orderIndex || 0) - (b.classLevel.orderIndex || 0);
      if (classDiff !== 0) return classDiff;
      return (a.subject.name || '').localeCompare(b.subject.name || '');
    });
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <DashboardNav slug={slug} role={auth.user.role} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {isTeacher ? 'My Teaching Allocations' : 'Academic Assignments'}
          </h1>
          <p className="text-sm text-slate-500">
            {isTeacher
              ? `Session: ${currentSession?.label || 'None'} • Your assigned classes, subjects, and homeroom responsibilities`
              : `Session: ${currentSession?.label || 'None'} • Session-Scoped Form Teachers & Subject Teachers`}
          </p>
        </div>

        {!isTeacher && currentSession && (
          <div className="flex flex-wrap items-center gap-3">
            <AssignSubjectTeacherModal
              slug={slug}
              classLevels={usableLevels}
              staffList={allTenantStaff}
              subjects={allTenantSubjects}
              sessionId={currentSession.id}
            />
          </div>
        )}
      </div>

      {/* Section 1: Form Teacher Assignment */}
      {isTeacher ? (
        <div className="mb-8">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs">
            <h2 className="text-base font-bold text-slate-900 mb-1">Form Teacher Allocation</h2>
            {formTeacherAssignments.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2.5 mt-3">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  Form Teacher
                </span>
                {formTeacherAssignments.map((fa: any) => (
                  <span
                    key={fa.id || fa.classLevelId}
                    className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-900 border border-slate-200"
                  >
                    {fa.classLevel.name}
                  </span>
                ))}
                <span className="text-xs text-slate-500">
                  (You are responsible for daily attendance, conduct remarks, and final broadsheet compilation for {formTeacherAssignments.length > 1 ? 'these classes' : 'this class'})
                </span>
              </div>
            ) : (
              <p className="text-sm text-slate-500 mt-2">
                You do not have an active Form Teacher allocation for this session. You are currently acting as a Subject Teacher.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Form Teachers by Class</h2>
              <p className="text-xs text-slate-500">
                Strictly resolved against active session {currentSession?.label} • Max 1 form teacher per class
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              {formTeacherAssignments.length} / {usableLevels.length} Classes Assigned
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {usableLevels.map((lvl: any) => {
              const ft = formTeacherAssignments.find((a: any) => a.classLevelId === lvl.id);
              return (
                <div
                  key={lvl.id}
                  className={`rounded-xl border p-4 shadow-2xs transition-all flex flex-col justify-between ${
                    ft
                      ? 'bg-white border-slate-200 hover:border-slate-300'
                      : 'bg-slate-50 border-dashed border-slate-200'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                        {lvl.name}
                      </span>
                      {ft && (
                        <span className="h-2 w-2 rounded-full bg-emerald-500" title="Assigned" />
                      )}
                    </div>
                    {ft ? (
                      <div className="mb-3">
                        <div className="font-semibold text-slate-900 text-sm">{ft.staff.name}</div>
                        <div className="text-xs text-slate-500 capitalize">{ft.staff.roleBase}</div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 italic py-2">No Form Teacher</div>
                    )}
                  </div>

                  {currentSession && (
                    <div className="pt-2 border-t border-slate-100">
                      <AssignFormTeacherModal
                        slug={slug}
                        classLevels={usableLevels}
                        staffList={allTenantStaff}
                        sessionId={currentSession.id}
                        initialClassLevelId={lvl.id}
                        triggerButton={
                          <button
                            type="button"
                            className="w-full py-1.5 px-2 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 border border-slate-200 transition-colors text-center cursor-pointer"
                          >
                            {ft ? '⇄ Change Teacher' : '+ Assign Teacher'}
                          </button>
                        }
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Section 2: Teaching Assignments (ClassLevel + Subject) */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {isTeacher ? 'Your Assigned Subjects' : 'Teaching Assignments'}
            </h2>
            <p className="text-xs text-slate-500">
              {teachingAssignments.length} Subject assignments active for session {currentSession?.label}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Class Level</th>
                <th className="px-6 py-3.5">Subject</th>
                {!isTeacher && <th className="px-6 py-3.5">Teacher</th>}
                <th className="px-6 py-3.5">Role Status</th>
                {!isTeacher && <th className="px-6 py-3.5 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {teachingAssignments.length === 0 ? (
                <tr>
                  <td colSpan={!isTeacher ? 5 : 3} className="px-6 py-12 text-center text-slate-400 text-sm">
                    {isTeacher
                      ? 'No teaching assignments allocated to your profile for this session.'
                      : 'No teaching assignments found. Click "Assign Subject Teacher" above to pair teachers with curriculum subjects.'}
                  </td>
                </tr>
              ) : (
                teachingAssignments.map((ta: any) => {
                  const isAlsoFormTeacher = formTeacherAssignments.some(
                    (ft: any) => ft.staffId === ta.staffId && ft.classLevelId === ta.classLevelId
                  );

                  return (
                    <tr key={ta.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-800">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          {ta.classLevel.name}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-900">{ta.subject.name}</td>
                      {!isTeacher && <td className="px-6 py-4 text-slate-700 font-medium">{ta.staff.name}</td>}
                      <td className="px-6 py-4">
                        {isAlsoFormTeacher ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                            Form Teacher & Subject Teacher
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">Subject Teacher</span>
                        )}
                      </td>
                      {!isTeacher && (
                        <td className="px-6 py-4 text-right">
                          <DeleteAssignmentButton
                            slug={slug}
                            assignmentId={ta.id}
                            title={`${ta.staff.name} - ${ta.subject.name} (${ta.classLevel.name})`}
                          />
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
    </div>
  );
}

