import React from 'react';
import { redirect, notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { getTenantDb } from '@/lib/tenant-db';
import DashboardNav from '@/components/dashboard-nav';
import { DeleteStudentButton } from './delete-student-button';
import { AddStudentModal } from './add-student-modal';
import { EditStudentModal } from './edit-student-modal';
import { ResetStudentPinModal } from './reset-student-pin-modal';
import { CsvExportButton } from '@/components/csv-export-button';
import { CsvImportModal } from '@/components/csv-import-modal';
import NormalizeStudentUsernamesButton from './normalize-student-usernames-button';
import { StudentTrackBadge } from './student-track-badge';
import { isSeniorSecondaryClass, getTenantCurriculum } from '@/lib/curriculum';

interface StudentsPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ classLevelId?: string; sessionId?: string }>;
}

export default async function StudentsPage({ params, searchParams }: StudentsPageProps) {
  const { slug } = await params;
  const { classLevelId, sessionId: requestedSessionId } = await searchParams;

  const tenant = await getTenantContext({ slug });
  if (!tenant) notFound();

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) redirect('/login');
  if (!['school_admin', 'teacher'].includes(auth.user.role)) redirect('/dashboard');

  const db = getTenantDb(tenant.id);
  const currentSession = tenant.currentSession;

  // Fetch available sessions
  const rawSessions = await db.academicSession.findMany({
    orderBy: { startDate: 'desc' },
  }).catch(() => []);
  const sessions = rawSessions.map((s: any) => ({
    id: s.id,
    label: s.label,
    isCurrent: s.isCurrent,
  }));

  // Determine active session filter:
  // - If user explicitly selected 'all', no session filter is applied.
  // - If user passed a specific session ID, filter by that session.
  // - Otherwise, default to current active session ID.
  const activeSessionId = requestedSessionId !== undefined
    ? (requestedSessionId === 'all' ? '' : requestedSessionId)
    : (currentSession?.id || '');

  const isTeacher = auth.user.role === 'teacher';

  // Find teacher's assigned class levels across teaching and form teacher allocations
  let teacherClassLevelIds: string[] = [];
  if (isTeacher && auth.user.staffId && currentSession) {
    const [tAssignments, ftAssignments] = await Promise.all([
      prisma.teachingAssignment.findMany({
        where: { staffId: auth.user.staffId, sessionId: currentSession.id },
        select: { classLevelId: true },
      }),
      prisma.formTeacherAssignment.findMany({
        where: { staffId: auth.user.staffId, sessionId: currentSession.id },
        select: { classLevelId: true },
      }),
    ]);
    teacherClassLevelIds = Array.from(new Set([
      ...tAssignments.map((a: any) => a.classLevelId),
      ...ftAssignments.map((a: any) => a.classLevelId),
    ])).filter(Boolean);
  }

  // Filter global class levels ladder to tenant's enabled range (§4.1), scoped if teacher
  const allLevels = await prisma.classLevel.findMany({ orderBy: { orderIndex: 'asc' } });
  const tenantLevels = allLevels.filter((lvl: any) => {
    if (!tenant.lowestClassLevel || !tenant.highestClassLevel) return true;
    return (
      lvl.orderIndex >= tenant.lowestClassLevel.orderIndex &&
      lvl.orderIndex <= tenant.highestClassLevel.orderIndex
    );
  });

  const usableLevels = isTeacher
    ? tenantLevels.filter((lvl: any) => teacherClassLevelIds.includes(lvl.id))
    : tenantLevels;

  const curriculum = await getTenantCurriculum(tenant.id);
  const allSubjects = await db.subject.findMany({ select: { id: true, name: true } }).catch(() => []);
  const subjectsMap = new Map<string, string>(allSubjects.map((s: any) => [s.id, s.name]));

  // Build enrollment filter with tenant isolation
  const enrollmentFilter: any = {
    student: { tenantId: tenant.id },
  };

  if (activeSessionId) {
    enrollmentFilter.sessionId = activeSessionId;
  }

  if (isTeacher) {
    if (classLevelId && teacherClassLevelIds.includes(classLevelId)) {
      enrollmentFilter.classLevelId = classLevelId;
    } else {
      enrollmentFilter.classLevelId = { in: teacherClassLevelIds };
    }
  } else if (classLevelId) {
    enrollmentFilter.classLevelId = classLevelId;
  }

  let rawEnrollments: any[] = await prisma.enrollment.findMany({
    where: enrollmentFilter,
    include: {
      session: { select: { id: true, label: true } },
    },
    orderBy: { createdAt: 'desc' },
  }).catch(() => []);

  // CRITICAL RESILIENCE FOR ZERO-STUDENT SESSION DISCONNECT:
  // If the default active session filter returned 0 enrollments, and user did NOT explicitly filter by a specific session,
  // automatically fall back to fetching all enrolled students across sessions so no student is ever hidden.
  let isCrossSessionFallback = false;
  if (rawEnrollments.length === 0 && requestedSessionId === undefined && !classLevelId && !isTeacher) {
    const fallbackEnrollments = await prisma.enrollment.findMany({
      where: {
        student: { tenantId: tenant.id },
      },
      include: {
        session: { select: { id: true, label: true } },
      },
      orderBy: { createdAt: 'desc' },
    }).catch(() => []);

    if (fallbackEnrollments.length > 0) {
      rawEnrollments = fallbackEnrollments;
      isCrossSessionFallback = true;
    }
  }

  const studentIds = Array.from(new Set(rawEnrollments.map((e: any) => e.studentId)));

  // If viewing all sessions or cross-session fallback without class filter,
  // also check if any student exists in the school who has no enrollment (e.g. power cut during onboarding)
  if (!isTeacher && (!classLevelId || classLevelId === '') && (requestedSessionId === 'all' || isCrossSessionFallback || !currentSession)) {
    const enrolledSet = new Set(studentIds);
    const unenrolledStudents = await prisma.student.findMany({
      where: {
        tenantId: tenant.id,
        id: { notIn: Array.from(enrolledSet) },
      },
      orderBy: { name: 'asc' },
    }).catch(() => []);

    for (const uns of unenrolledStudents) {
      rawEnrollments.push({
        id: `unassigned-${uns.id}`,
        studentId: uns.id,
        classLevelId: '',
        sessionId: '',
        status: 'active' as const,
        createdAt: uns.createdAt,
        session: { id: '', label: 'Unassigned' },
      });
      studentIds.push(uns.id);
    }
  }

  const classLevelIds = Array.from(new Set(rawEnrollments.map((e: any) => e.classLevelId))).filter(Boolean);

  const studentsMap = new Map<string, any>();
  if (studentIds.length > 0) {
    let students: any[] = [];
    try {
      students = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, name, tenant_id as "tenantId", admission_number as "admissionNumber", guardian_contact_info as "guardianContactInfo", created_at as "createdAt"
         FROM students WHERE id = ANY($1::text[])`,
        studentIds
      );
    } catch {
      students = await prisma.student.findMany({
        where: { id: { in: studentIds } },
      }).catch(() => []);
    }

    // Auto-generate on the fly for any enrolled student missing an admission number
    for (const s of students) {
      let adm = s.admissionNumber || (s.guardianContactInfo as any)?.admissionNo;
      if (!adm) {
        try {
          const { generateNextAdmissionNumber } = await import('@/lib/admission-number');
          adm = await generateNextAdmissionNumber(tenant.id);
          await prisma.$executeRawUnsafe(
            `UPDATE "students" 
             SET "admission_number" = $1, 
                 "guardian_contact_info" = jsonb_set(COALESCE("guardian_contact_info"::jsonb, '{}'::jsonb), '{admissionNo}', to_jsonb($1::text)),
                 "updated_at" = NOW() 
             WHERE "id" = $2 AND "tenant_id" = $3`,
            adm,
            s.id,
            tenant.id
          );
          s.admissionNumber = adm;
        } catch (genErr) {
          console.warn('[Auto-assign admission number error]', genErr);
        }
      } else if (!s.admissionNumber && adm) {
        s.admissionNumber = adm;
      }
      studentsMap.set(s.id, s);
    }
  }

  const classLevelsMap = new Map<string, any>();
  if (classLevelIds.length > 0) {
    const levels = await prisma.classLevel.findMany({
      where: { id: { in: classLevelIds } },
    }).catch(() => []);
    for (const l of levels) classLevelsMap.set(l.id, l);
  }

  // Deduplicate when viewing cross-session or all sessions so each student appears once with their latest class
  const seenStudentIds = new Set<string>();
  const dedupedEnrollments: any[] = [];
  for (const e of rawEnrollments) {
    if (activeSessionId && !isCrossSessionFallback) {
      dedupedEnrollments.push(e);
    } else {
      if (!seenStudentIds.has(e.studentId)) {
        seenStudentIds.add(e.studentId);
        dedupedEnrollments.push(e);
      }
    }
  }

  const enrollments = dedupedEnrollments.map((e: any) => ({
    ...e,
    student: studentsMap.get(e.studentId) || { name: 'Unknown Student', guardianContactInfo: null },
    classLevel: classLevelsMap.get(e.classLevelId) || { name: 'Unassigned', orderIndex: 0 },
    session: e.session || { label: 'Unassigned' },
  }));

  enrollments.sort((a: any, b: any) => {
    if (a.classLevel.orderIndex !== b.classLevel.orderIndex) {
      return a.classLevel.orderIndex - b.classLevel.orderIndex;
    }
    return (a.student.name || '').localeCompare(b.student.name || '');
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <DashboardNav slug={slug} role={auth.user.role} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Student Roster</h1>
          <p className="text-sm text-slate-500">
            {isCrossSessionFallback
              ? `Showing all school students (${enrollments.length} Enrolled) • Active Session is ${currentSession ? currentSession.label : 'None'}`
              : activeSessionId
              ? `Session: ${sessions.find((s: any) => s.id === activeSessionId)?.label || currentSession?.label || 'Custom'} • ${enrollments.length} Enrolled`
              : `All Academic Sessions • ${enrollments.length} Enrolled`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Filter by academic session and class level */}
          <form method="GET" className="flex flex-wrap items-center gap-2">
            <label htmlFor="sessionId" className="text-xs font-semibold text-slate-600">
              Session:
            </label>
            <select
              id="sessionId"
              name="sessionId"
              defaultValue={requestedSessionId !== undefined ? requestedSessionId : (currentSession?.id || 'all')}
              className="text-xs rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-slate-700 shadow-2xs focus:ring-2 focus:ring-blue-500 font-medium"
            >
              <option value="all">All Academic Sessions</option>
              {sessions.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.label} {s.isCurrent ? '★ (Active)' : ''}
                </option>
              ))}
            </select>

            <label htmlFor="classLevelId" className="text-xs font-semibold text-slate-600">
              Class:
            </label>
            <select
              id="classLevelId"
              name="classLevelId"
              defaultValue={classLevelId || ''}
              className="text-xs rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-700 shadow-2xs focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Enabled Classes</option>
              {usableLevels.map((lvl: any) => (
                <option key={lvl.id} value={lvl.id}>
                  {lvl.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-white hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Filter
            </button>
          </form>

          {auth.user.role === 'school_admin' && (
            <>
              <NormalizeStudentUsernamesButton slug={slug} />
              <CsvExportButton
                filename={`${slug}-students-roster`}
                headers={[
                  'Internal Record ID (system use)',
                  'Admission Number',
                  'Student Name',
                  'Current Class',
                  'Session',
                  'Academic Track',
                  'Enrollment Status',
                  'Guardian Name',
                  'Relationship',
                  'Guardian Phone',
                  'Guardian Email',
                  'Residential Address',
                ]}
                rows={enrollments.map((e: any) => [
                  e.student.id,
                  e.student.admissionNumber || (e.student.guardianContactInfo as any)?.admissionNo || '',
                  e.student.name,
                  e.classLevel.name,
                  e.session?.label || '',
                  (e.student.guardianContactInfo as any)?.departmentTrack || (isSeniorSecondaryClass(e.classLevel) ? 'general' : 'core'),
                  e.status,
                  e.student.guardianContactInfo?.guardianName || e.student.guardianContactInfo?.name || '',
                  e.student.guardianContactInfo?.relationship || '',
                  e.student.guardianContactInfo?.guardianPhone || e.student.guardianContactInfo?.phone || '',
                  e.student.guardianContactInfo?.guardianEmail || e.student.guardianContactInfo?.email || '',
                  e.student.guardianContactInfo?.address || '',
                ])}
                label="Export Students (CSV)"
              />
              <CsvImportModal
                slug={slug}
                entityName="Students"
                importEndpoint="/api/tenant/students/import"
                payloadKey="students"
                sampleHeaders={['Admission Number (Optional)', 'Student Name', 'Class Level', 'Guardian Name', 'Relationship', 'Phone', 'Email', 'Address']}
                sampleRows={[
                  ['APEX/2026/0001', 'Chinedu Okonkwo', 'JSS 1', 'Chief Emeka Okonkwo', 'Father', '+2348031234567', 'emeka.okonkwo@example.com', '12 Marina Road, Lagos'],
                  ['APEX/2026/0002', 'Amina Bello', 'SS 2', 'Hajiya Fatima Bello', 'Mother', '+2348029876543', 'fatima.bello@example.com', '5 Kano Crescent, Abuja'],
                ]}
                fieldMapping={{
                  'Admission Number': 'admissionNumber',
                  'admission number': 'admissionNumber',
                  'admission_number': 'admissionNumber',
                  'Adm No': 'admissionNumber',
                  'adm no': 'admissionNumber',
                  'admissionNo': 'admissionNumber',
                  'Student Name': 'name',
                  'student name': 'name',
                  'name': 'name',
                  'Class Level': 'className',
                  'class level': 'className',
                  'class': 'className',
                  'Guardian Name': 'guardianName',
                  'guardian name': 'guardianName',
                  'Relationship': 'relationship',
                  'relationship': 'relationship',
                  'Phone': 'phone',
                  'phone': 'phone',
                  'Email': 'email',
                  'email': 'email',
                  'Address': 'address',
                  'address': 'address',
                }}
                buttonLabel="Import Students (CSV)"
              />
              <AddStudentModal
                slug={slug}
                usableLevels={usableLevels}
                sessions={sessions}
                defaultSessionId={currentSession?.id}
              />
            </>
          )}
        </div>
      </div>

      {/* Student List Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="px-6 py-3.5">Student Name</th>
              <th className="px-6 py-3.5">Class Level</th>
              <th className="px-6 py-3.5">Academic Session</th>
              <th className="px-6 py-3.5">Academic Track</th>
              <th className="px-6 py-3.5">Status</th>
              <th className="px-6 py-3.5">Guardian Contact</th>
              <th className="px-6 py-3.5">Enrolled Since</th>
              {auth.user.role === 'school_admin' && <th className="px-6 py-3.5 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {enrollments.length === 0 ? (
              <tr>
                <td colSpan={auth.user.role === 'school_admin' ? 8 : 7} className="px-6 py-12 text-center text-slate-400 text-sm">
                  No enrolled students found for this selection.
                </td>
              </tr>
            ) : (
              enrollments.map((e: any) => {
                const guardian = e.student.guardianContactInfo as any;
                const isSenior = isSeniorSecondaryClass(e.classLevel);
                return (
                  <tr key={e.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{e.student.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {e.student.admissionNumber || guardian?.admissionNo || (e.student.guardianContactInfo as any)?.admissionNo || 'No Adm No'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                        {e.classLevel.name}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 font-mono">
                        {e.session?.label || 'Unassigned'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {isSenior ? (
                        <StudentTrackBadge
                          slug={slug}
                          studentId={e.student.id}
                          studentName={e.student.name}
                          classLevelName={e.classLevel.name}
                          currentTrack={guardian?.departmentTrack}
                          currentElectiveIds={
                            Array.isArray(guardian?.electiveSubjectIds) ? guardian.electiveSubjectIds : []
                          }
                          availableElectiveSubjects={
                            (curriculum.classes[e.classLevel.id] || [])
                              .filter((o) => o.isElective)
                              .map((o) => ({
                                id: o.subjectId,
                                name: subjectsMap.get(o.subjectId) || 'Elective Subject',
                                department:
                                  o.department ||
                                  (Array.isArray(o.departments) && o.departments.length > 0
                                    ? o.departments[0]
                                    : undefined),
                              }))
                          }
                          isAdmin={auth.user.role === 'school_admin'}
                        />
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium text-slate-500 bg-slate-100 border border-slate-200">
                          Core Only
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${
                          e.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : e.status === 'repeated'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                      >
                        {e.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600">
                      {guardian ? (
                        <div>
                          <div className="font-medium text-slate-800">{guardian.name || 'Guardian'}</div>
                          <div className="text-slate-500">{guardian.phone || guardian.email || '—'}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400">None</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {new Date(e.createdAt).toLocaleDateString()}
                    </td>
                    {auth.user.role === 'school_admin' && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <EditStudentModal
                            slug={slug}
                            student={{
                              id: e.student.id,
                              name: e.student.name,
                              admissionNumber: e.student.admissionNumber,
                              admissionNo: e.student.admissionNumber || guardian?.admissionNo || (e.student.guardianContactInfo as any)?.admissionNo || '',
                              gender: guardian?.gender || (e.student.guardianContactInfo as any)?.gender || 'male',
                              dob: (e.student.guardianContactInfo as any)?.dob || null,
                              studentEmail: (e.student.guardianContactInfo as any)?.studentEmail || null,
                              guardianName: guardian?.name || guardian?.guardianName || (e.student.guardianContactInfo as any)?.guardianName || '',
                              guardianPhone: guardian?.phone || guardian?.guardianPhone || (e.student.guardianContactInfo as any)?.guardianPhone || '',
                              guardianEmail: guardian?.email || guardian?.guardianEmail || (e.student.guardianContactInfo as any)?.guardianEmail || '',
                              height: guardian?.height || guardian?.ht || '',
                              weight: guardian?.weight || guardian?.wt || '',
                              club: guardian?.club || guardian?.society || '',
                              favColor: guardian?.favColor || guardian?.favoriteColor || '',
                              avatarUrl: guardian?.avatarUrl || '',
                              bloodGroup: guardian?.bloodGroup || (e.student.guardianContactInfo as any)?.bloodGroup || '',
                              currentClassLevelId: e.classLevel.id,
                              departmentTrack: guardian?.departmentTrack || 'general',
                            }}
                            usableLevels={usableLevels}
                            sessions={sessions}
                            currentSessionId={e.session?.id || currentSession?.id}
                          />
                          <ResetStudentPinModal
                            slug={slug}
                            studentId={e.student.id}
                            studentName={e.student.name}
                            admissionNumber={e.student.admissionNumber}
                          />
                          <DeleteStudentButton
                            slug={slug}
                            studentId={e.student.id}
                            studentName={e.student.name}
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
