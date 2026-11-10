import React from 'react';
import { redirect, notFound } from 'next/navigation';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { listTenantJobs } from '@/lib/queue/job-queue';
import JobsClient from './jobs-client';

interface JobsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function JobsPage({ params }: JobsPageProps) {
  const { slug } = await params;
  const tenant = await getTenantContext({ slug });

  if (!tenant) {
    notFound();
  }

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) {
    redirect('/login');
  }

  // School admin and teachers can access background jobs
  if (!['school_admin', 'teacher'].includes(auth.user.role)) {
    redirect('/dashboard');
  }

  const initialData = await listTenantJobs(tenant.id, {
    page: 1,
    pageSize: 20,
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <JobsClient
        slug={slug}
        tenantName={tenant.name}
        isSchoolAdmin={auth.user.role === 'school_admin'}
        initialData={{
          jobs: initialData.jobs.map((job: any) => ({
            ...job,
            createdAt: job.createdAt.toISOString(),
            updatedAt: job.updatedAt.toISOString(),
            startedAt: job.startedAt ? job.startedAt.toISOString() : null,
            completedAt: job.completedAt ? job.completedAt.toISOString() : null,
          })),
          totalCount: initialData.totalCount,
          totalPages: initialData.totalPages,
          page: initialData.page,
          pageSize: initialData.pageSize,
        }}
      />
    </div>
  );
}
