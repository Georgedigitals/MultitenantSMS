import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { getTenantDb } from '@/lib/tenant-db';
import { getPlatformLocalization } from '@/lib/platform-settings';
import { formatMoney } from '@/lib/i18n/currency';
import prisma from '@/lib/prisma';

interface PortalFeesPageProps {
  params: Promise<{ slug: string }>;
}

export default async function PortalFeesPage({ params }: PortalFeesPageProps) {
  const { slug } = await params;
  const [tenant, localization] = await Promise.all([
    getTenantContext({ slug }),
    getPlatformLocalization(),
  ]);
  if (!tenant) notFound();

  const formatNaira = (amount: number) =>
    formatMoney(amount, {
      baseCurrencyCode: localization.baseCurrencyCode,
      currencyCode: localization.currencyCode,
      currencySymbol: localization.currencySymbol,
      locale: localization.locale,
      exchangeRate: localization.exchangeRate,
      autoConvertCurrency: localization.autoConvertCurrency,
    });

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) redirect(`/${slug}/login`);

  const { user } = auth;
  if (user.role === 'school_admin' || user.role === 'teacher') redirect(`/${slug}/dashboard`);

  if (!tenant.hasFeature('school_fees')) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-black text-slate-900">Fee Management</h1>
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center text-slate-500">
          Fee management is not enabled for this school. Contact the school administrator.
        </div>
      </div>
    );
  }

  const db = getTenantDb(tenant.id);
  const isParent = user.role === 'parent';
  let studentIds: string[] = [];

  if (isParent) {
    const { getParentWardsForUser } = await import('@/lib/guardian');
    const parentData = await getParentWardsForUser(tenant.id, user);
    studentIds = parentData.studentIds;
  } else if (user.studentId) {
    studentIds = [user.studentId];
  }

  const studentsData = await Promise.all(
    studentIds.map(async (sid) => {
      const student = await db.student.findUnique({ where: { id: sid } }).catch(() => null);
      if (!student) return null;

      const enrollment = await db.enrollment.findFirst({
        where: { studentId: sid },
        orderBy: { createdAt: 'desc' },
        include: { classLevel: true },
      }).catch(() => null);

      const classLevelId = (enrollment as any)?.classLevelId;

      const feeItems = await db.feeItem.findMany({
        where: classLevelId ? { OR: [{ classLevelId }, { classLevelId: null }] } : {},
      }).catch(() => []);

      const payments = await db.feePayment.findMany({
        where: { studentId: sid },
        orderBy: { paidAt: 'desc' },
      }).catch(() => []);

      const totalCharged = feeItems.reduce((sum: number, f: any) => sum + Number(f.amount || 0), 0);
      const totalPaid = payments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
      const balance = totalCharged - totalPaid;

      return { student, feeItems, payments, totalCharged, totalPaid, balance };
    })
  );

  const validStudents = studentsData.filter(Boolean) as NonNullable<typeof studentsData[0]>[];
  const primaryColor = tenant.branding.primaryColor || '#1E3A8A';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">School Fees</h1>
        <p className="text-sm text-slate-500 mt-1">Your fee balance and payment history at {tenant.name}.</p>
      </div>

      {validStudents.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-3 text-emerald-600">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 00-2 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <p className="font-bold text-slate-700">No Fee Records</p>
          <p className="text-sm text-slate-500 mt-1">No fee assignments found. Contact the school administration.</p>
        </div>
      ) : (
        validStudents.map((sd) => (
          <div key={sd.student.id} className="space-y-4">
            {isParent && (
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl text-white flex items-center justify-center font-black text-lg"
                  style={{ backgroundColor: primaryColor }}
                >
                  {sd.student.name.charAt(0)}
                </div>
                <p className="font-black text-slate-900">{sd.student.name}</p>
              </div>
            )}

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Total Charged</p>
                <p className="text-lg font-black text-slate-900">{formatNaira(sd.totalCharged)}</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Total Paid</p>
                <p className="text-lg font-black text-emerald-600">{formatNaira(sd.totalPaid)}</p>
              </div>
              <div className={`rounded-2xl border shadow-sm p-4 text-center ${sd.balance > 0 ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'}`}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Balance Due</p>
                <p className={`text-lg font-black ${sd.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {formatNaira(Math.max(0, sd.balance))}
                </p>
              </div>
            </div>

            {/* Payment history */}
            {sd.payments.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60">
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Payment History</p>
                </div>
                <div className="divide-y divide-slate-100">
                  {sd.payments.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{p.paymentRef ? `Ref: ${p.paymentRef}` : 'Fee Payment'}</p>
                        <p className="text-[11px] text-slate-500">
                          {new Date(p.paidAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <p className="font-black text-emerald-600 text-sm">{formatNaira(Number(p.amount))}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs text-blue-700">
        <strong>Note:</strong> For fee payments or disputes, contact the school bursar or administration at {tenant.name}.
      </div>
    </div>
  );
}
