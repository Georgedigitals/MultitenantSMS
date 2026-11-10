import React from 'react';
import { redirect, notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { getTenantDb } from '@/lib/tenant-db';
import DashboardNav from '@/components/dashboard-nav';
import GradingClient from './grading-client';

interface GradingPageProps {
  params: Promise<{ slug: string }>;
}

export default async function GradingPage({ params }: GradingPageProps) {
  const { slug } = await params;

  const tenant = await getTenantContext({ slug });
  if (!tenant) notFound();

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) redirect('/login');
  if (auth.user.role !== 'school_admin') redirect('/dashboard');

  const db = getTenantDb(tenant.id);

  // Fetch current session and terms
  const currentSession = await db.academicSession.findFirst({
    where: { isCurrent: true },
  });

  const rawTerms = currentSession
    ? await db.term.findMany({
        where: { sessionId: currentSession.id },
        orderBy: { startDate: 'asc' },
      })
    : [];

  const terms = rawTerms.map((t: any) => ({ id: t.id, name: t.name }));
  const currentTerm = rawTerms.find((t: any) => t.isCurrent) || terms[0];

  // Fetch assessment components (try current term or default)
  let components: any[] = [];
  let isLocked = false;

  if (currentTerm) {
    const submission = await prisma.resultEntry.findFirst({
      where: {
        termId: currentTerm.id,
        status: { in: ['submitted', 'form_teacher_reviewed', 'published'] },
      },
    });
    isLocked = submission !== null;

    components = await db.assessmentComponent.findMany({
      where: { termId: currentTerm.id },
      orderBy: { orderIndex: 'asc' },
    });
  }

  if (components.length === 0) {
    components = await db.assessmentComponent.findMany({
      where: { termId: null },
      orderBy: { orderIndex: 'asc' },
    });
  }

  // Fetch grading scales and deduplicate
  const rawScales = await db.gradingScale.findMany({
    orderBy: { minScore: 'desc' },
  });

  const seenScaleKeys = new Set<string>();
  const uniqueRawScales = rawScales.filter((s: any) => {
    const key = `${s.lowestClassLevelId}_${s.highestClassLevelId}_${s.grade}_${Number(s.minScore)}_${Number(s.maxScore)}`;
    if (seenScaleKeys.has(key)) return false;
    seenScaleKeys.add(key);
    return true;
  });

  const classLevelIds = Array.from(new Set([
    ...uniqueRawScales.map((s: any) => s.lowestClassLevelId),
    ...uniqueRawScales.map((s: any) => s.highestClassLevelId),
  ])).filter(Boolean);

  const scaleClassLevels = classLevelIds.length > 0
    ? await prisma.classLevel.findMany({ where: { id: { in: classLevelIds } } })
    : [];
  const scaleClassMap = new Map(scaleClassLevels.map((c: any) => [c.id, c]));

  const scales = uniqueRawScales.map((s: any) => ({
    ...s,
    lowestClassLevel: s.lowestClassLevelId ? scaleClassMap.get(s.lowestClassLevelId) : null,
    highestClassLevel: s.highestClassLevelId ? scaleClassMap.get(s.highestClassLevelId) : null,
  }));

  // Fetch tenant-scoped class levels
  const allClassLevels = await prisma.classLevel.findMany({
    orderBy: { orderIndex: 'asc' },
  });

  const minOrder = tenant.lowestClassLevel?.orderIndex ?? 1;
  const maxOrder = tenant.highestClassLevel?.orderIndex ?? 15;
  const tenantClassLevels = allClassLevels.filter(
    (cl: any) => cl.orderIndex >= minOrder && cl.orderIndex <= maxOrder
  );

  const canCustomize = tenant.hasFeature('grading_customization');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <DashboardNav slug={slug} role={auth.user.role} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Assessment & Grading System</h1>
          <p className="text-sm text-slate-500">
            Configure score breakdowns, weightings, and grade conversion scales for {tenant.name}
          </p>
        </div>
      </div>

      <GradingClient
        slug={slug}
        canCustomize={canCustomize}
        initialComponents={components.map((c: any) => ({
          id: c.id,
          name: c.name,
          maxScore: c.maxScore,
          weightPercent: Number(c.weightPercent),
          orderIndex: c.orderIndex,
        }))}
        initialScales={scales.map((s: any) => ({
          id: s.id,
          lowestClassLevelId: s.lowestClassLevelId,
          highestClassLevelId: s.highestClassLevelId,
          lowestClassLevel: s.lowestClassLevel
            ? { name: s.lowestClassLevel.name, orderIndex: s.lowestClassLevel.orderIndex }
            : undefined,
          highestClassLevel: s.highestClassLevel
            ? { name: s.highestClassLevel.name, orderIndex: s.highestClassLevel.orderIndex }
            : undefined,
          minScore: Number(s.minScore),
          maxScore: Number(s.maxScore),
          grade: s.grade,
          remark: s.remark,
        }))}
        classLevels={tenantClassLevels.map((cl: any) => ({
          id: cl.id,
          name: cl.name,
          orderIndex: cl.orderIndex,
        }))}
        terms={terms}
        currentTermId={currentTerm?.id}
        isLocked={isLocked}
      />
    </div>
  );
}
