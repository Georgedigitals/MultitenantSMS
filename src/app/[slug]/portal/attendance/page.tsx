import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { getTenantDb } from '@/lib/tenant-db';
import prisma from '@/lib/prisma';

interface PortalAttendancePageProps {
  params: Promise<{ slug: string }>;
}

export default async function PortalAttendancePage({ params }: PortalAttendancePageProps) {
  const { slug } = await params;
  const tenant = await getTenantContext({ slug });
  if (!tenant) notFound();

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) redirect(`/${slug}/login`);

  const { user } = auth;
  if (user.role === 'school_admin' || user.role === 'teacher') redirect(`/${slug}/dashboard`);

  const db = getTenantDb(tenant.id);
  const isParent = user.role === 'parent';
  const primaryColor = tenant.branding.primaryColor || '#1E3A8A';

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

      const records = await db.attendanceRecord.findMany({
        where: { studentId: sid },
        orderBy: { date: 'desc' },
        take: 60,
      }).catch(() => []);

      const total = records.length;
      const present = records.filter((r: any) => r.status === 'present').length;
      const absent = records.filter((r: any) => r.status === 'absent').length;
      const late = records.filter((r: any) => r.status === 'late').length;
      const pct = total > 0 ? Math.round((present / total) * 100) : null;

      return { student, records, total, present, absent, late, pct };
    })
  );

  const validStudents = studentsData.filter(Boolean) as NonNullable<typeof studentsData[0]>[];

  const statusColor: Record<string, string> = {
    present: 'bg-emerald-100 text-emerald-700',
    absent: 'bg-rose-100 text-rose-700',
    late: 'bg-amber-100 text-amber-700',
    excused: 'bg-slate-100 text-slate-600',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Attendance Record</h1>
        <p className="text-sm text-slate-500 mt-1">Your attendance history at {tenant.name} (last 60 entries).</p>
      </div>

      {validStudents.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center mx-auto mb-3 text-indigo-600">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="font-bold text-slate-700">No Attendance Records</p>
          <p className="text-sm text-slate-500 mt-1">No attendance data found. Contact the school if you believe this is an error.</p>
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

            {/* Summary stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Total Days</p>
                <p className="text-2xl font-black text-slate-900">{sd.total}</p>
              </div>
              <div className="bg-white rounded-2xl border border-emerald-200 bg-emerald-50 shadow-sm p-4 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Present</p>
                <p className="text-2xl font-black text-emerald-600">{sd.present}</p>
              </div>
              <div className="bg-white rounded-2xl border border-rose-200 bg-rose-50 shadow-sm p-4 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Absent</p>
                <p className="text-2xl font-black text-rose-600">{sd.absent}</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Attendance %</p>
                <p
                  className="text-2xl font-black"
                  style={{ color: (sd.pct ?? 0) >= 75 ? '#16a34a' : '#dc2626' }}
                >
                  {sd.pct !== null ? `${sd.pct}%` : 'N/A'}
                </p>
              </div>
            </div>

            {/* Attendance list */}
            {sd.records.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60">
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Recent Attendance</p>
                </div>
                <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                  {sd.records.map((r: any) => (
                    <div key={r.id} className="flex items-center justify-between px-5 py-2.5">
                      <p className="text-xs font-semibold text-slate-700">
                        {new Date(r.date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${statusColor[r.status] || 'bg-slate-100 text-slate-600'}`}>
                        {r.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
