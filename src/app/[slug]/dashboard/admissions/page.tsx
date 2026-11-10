import { notFound, redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';

export default async function AdmissionsInboxPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await getTenantContext({ slug });
  if (!tenant) notFound();

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) redirect('/login');
  if (auth.user.role !== 'school_admin') redirect('/dashboard');

  const inquiries = await prisma.notification.findMany({
    where: {
      tenantId: tenant.id,
      recipientId: auth.user.id,
      recipientType: 'school_admin',
      type: 'admissions_inquiry',
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { id: true, message: true, readAt: true, createdAt: true },
  });

  const unseenIds = inquiries.filter((item) => !item.readAt).map((item) => item.id);
  if (unseenIds.length > 0) {
    await prisma.notification.updateMany({
      where: { id: { in: unseenIds }, tenantId: tenant.id, recipientId: auth.user.id },
      data: { readAt: new Date() },
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Admissions</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">Online inquiries</h1>
        <p className="mt-2 text-sm text-slate-600">Messages sent through the school website appear here and in your notification bell.</p>
      </header>

      {inquiries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <h2 className="font-semibold text-slate-900">No admission inquiries yet</h2>
          <p className="mt-2 text-sm text-slate-600">New enquiries will be listed here when families submit the public form.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {inquiries.map((inquiry) => {
            const [title, ...details] = inquiry.message.split('\n');
            return (
              <article key={inquiry.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                  <h2 className="font-semibold text-slate-950">{title}</h2>
                  <time className="shrink-0 text-xs text-slate-500" dateTime={inquiry.createdAt.toISOString()}>
                    {inquiry.createdAt.toLocaleString()}
                  </time>
                </div>
                <div className="mt-3 space-y-1 text-sm text-slate-700">
                  {details.map((detail, index) => <p key={index} className="break-words">{detail}</p>)}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
