import React from 'react';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { getTenantDb } from '@/lib/tenant-db';
import DashboardNav from '@/components/dashboard-nav';
import { DeleteSubjectButton } from './delete-subject-button';
import { AddSubjectModal } from './add-subject-modal';
import { EditSubjectModal } from './edit-subject-modal';
import { CsvExportButton } from '@/components/csv-export-button';
import { CsvImportModal } from '@/components/csv-import-modal';
import { ClassCurriculumClient } from './class-curriculum-client';
import { getTenantCurriculum } from '@/lib/curriculum';
import { getTenantClassLevels } from '@/lib/class-levels';
import { BookOpen, Layers } from 'lucide-react';

interface SubjectsPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function SubjectsPage({ params, searchParams }: SubjectsPageProps) {
  const { slug } = await params;
  const { tab = 'catalog' } = await searchParams;

  const tenant = await getTenantContext({ slug });
  if (!tenant) notFound();

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) redirect('/login');
  if (!['school_admin', 'teacher'].includes(auth.user.role)) redirect('/dashboard');

  const isTeacher = auth.user.role === 'teacher';
  const isAdmin = auth.user.role === 'school_admin';
  const db = getTenantDb(tenant.id);

  let subjects: any[] = [];
  if (isTeacher) {
    if (auth.user.staffId) {
      const assigns = await db.teachingAssignment.findMany({
        where: { staffId: auth.user.staffId },
        select: { subjectId: true },
      });
      const assignedSubjectIds: string[] = Array.from(new Set(assigns.map((a: any) => a.subjectId as string)));
      subjects = await db.subject.findMany({
        where: { id: { in: assignedSubjectIds } },
        include: {
          _count: {
            select: { teachingAssignments: true },
          },
        },
        orderBy: { name: 'asc' },
      }).catch(() => []);
    }
  } else {
    subjects = await db.subject.findMany({
      include: {
        _count: {
          select: { teachingAssignments: true },
        },
      },
      orderBy: { name: 'asc' },
    }).catch(() => []);
  }

  // Fetch tenant class levels for the Curriculum Matrix
  const tenantLevels = await getTenantClassLevels(tenant.id, { filterLegacyByRange: true });

  const allSubjects = subjects.map((s: any) => ({
    id: s.id,
    name: s.name,
  }));

  const curriculum = await getTenantCurriculum(tenant.id);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <DashboardNav slug={slug} role={auth.user.role} />

      {/* Admin Tab Switcher */}
      {isAdmin && (
        <div className="flex items-center gap-2 mb-6 border-b border-slate-200 pb-3">
          <Link
            href={`/${slug}/dashboard/subjects?tab=catalog`}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              tab !== 'curriculum'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Subject Directory</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                tab !== 'curriculum' ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {subjects.length}
            </span>
          </Link>

          <Link
            href={`/${slug}/dashboard/subjects?tab=curriculum`}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              tab === 'curriculum'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Class Curriculum & Electives</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                tab === 'curriculum' ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {tenantLevels.length} Classes
            </span>
          </Link>
        </div>
      )}

      {/* Class Curriculum Matrix Tab */}
      {isAdmin && tab === 'curriculum' ? (
        <div>
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Class Curriculum & Elective Tracks
            </h1>
            <p className="text-sm text-slate-500">
              Configure which subjects are taught in each class level. For Senior Secondary (SSS 1–3), designate Core vs Elective subjects by track (Science, Arts, Commercial). Junior & Primary classes operate on 100% Core with zero elective overhead.
            </p>
          </div>

          <ClassCurriculumClient
            slug={slug}
            classLevels={tenantLevels}
            allSubjects={allSubjects}
            initialCurriculum={curriculum}
          />
        </div>
      ) : (
        /* Subject Directory (Catalog) Tab */
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {isTeacher ? 'My Assigned Subjects' : 'Curriculum Subjects'}
              </h1>
              <p className="text-sm text-slate-500">
                {isTeacher
                  ? `${subjects.length} Subjects allocated to your teaching schedule`
                  : `${subjects.length} Subjects Configured for ${tenant.name}`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <CsvExportButton
                filename={`${slug}-subjects-list`}
                headers={['Subject ID', 'Subject Name', 'Assigned Classes/Teachers Count']}
                rows={subjects.map((sub: any) => [
                  sub.id,
                  sub.name,
                  sub._count?.teachingAssignments || 0,
                ])}
                label="Export Subjects (CSV)"
              />
              {auth.user.role === 'school_admin' && (
                <>
                  <CsvImportModal
                    slug={slug}
                    entityName="Subjects"
                    importEndpoint="/api/tenant/subjects/import"
                    payloadKey="subjects"
                    sampleHeaders={['Subject Name']}
                    sampleRows={[
                      ['Mathematics'],
                      ['English Language'],
                      ['Biology'],
                      ['Chemistry'],
                      ['Physics'],
                      ['Civic Education'],
                      ['Economics'],
                      ['Agricultural Science'],
                    ]}
                    fieldMapping={{
                      'Subject Name': 'name',
                      'subject name': 'name',
                      'subject': 'name',
                      'name': 'name',
                    }}
                    buttonLabel="Import Subjects (CSV)"
                  />
                  <AddSubjectModal slug={slug} />
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subjects.length === 0 ? (
              <div className="col-span-full bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
                No subjects configured yet.
              </div>
            ) : (
              subjects.map((sub: any) => (
                <div
                  key={sub.id}
                  className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs hover:border-slate-300 transition-all flex items-center justify-between"
                >
                  <div>
                    <h3 className="font-semibold text-slate-900 text-base">{sub.name}</h3>
                    <span className="text-xs text-slate-500">
                      {sub._count.teachingAssignments} Active Teaching Assignment(s)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                      {sub.name.substring(0, 2).toUpperCase()}
                    </div>
                    {auth.user.role === 'school_admin' && (
                      <>
                        <EditSubjectModal
                          slug={slug}
                          subject={{
                            id: sub.id,
                            name: sub.name,
                          }}
                        />
                        <DeleteSubjectButton
                          slug={slug}
                          subjectId={sub.id}
                          subjectName={sub.name}
                        />
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
