import prisma from './prisma';

/**
 * Escapes a single cell value for CSV output.
 */
function escapeCSVCell(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Formats headers and rows into a standard CSV string.
 */
function toCSV(headers: string[], rows: any[][]): string {
  const headerLine = headers.map(escapeCSVCell).join(',');
  const rowLines = rows.map((row) => row.map(escapeCSVCell).join(','));
  return [headerLine, ...rowLines].join('\n');
}

/**
 * Generates a complete, structured JSON export bundle of all tenant data for NDPR compliance and offboarding (§11.7, §11.8).
 */
export async function exportTenantDataJSON(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      plan: true,
      domainAliases: true,
      featureOverrides: true,
    },
  });

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  const academicSessions = await prisma.academicSession.findMany({
    where: { tenantId },
    include: { terms: true },
  });

  const staff = await prisma.staff.findMany({
    where: { tenantId },
  });

  const students = await prisma.student.findMany({
    where: { tenantId },
    include: {
      enrollments: {
        include: {
          classLevel: true,
          session: true,
        },
      },
    },
  });

  const feeItems = await prisma.feeItem.findMany({
    where: { tenantId },
    include: {
      term: true,
      classLevel: true,
    },
  });

  const siteContents = await prisma.siteContent.findMany({
    where: { tenantId },
  });

  const notifications = await prisma.notification.findMany({
    where: { tenantId },
  });

  const resultEntries = await prisma.resultEntry.findMany({
    where: {
      student: { tenantId },
    },
    include: {
      student: { select: { id: true, name: true } },
      term: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true } },
    },
  });

  const resultPins = await prisma.resultPIN.findMany({
    where: {
      student: { tenantId },
    },
  });

  const feePayments = await prisma.feePayment.findMany({
    where: {
      student: { tenantId },
    },
    include: {
      student: { select: { id: true, name: true } },
      term: { select: { id: true, name: true } },
    },
  });

  const studentFeeAdjustments = await prisma.studentFeeAdjustment.findMany({
    where: {
      student: { tenantId },
    },
    include: {
      student: { select: { id: true, name: true } },
      feeItem: { select: { id: true, name: true } },
    },
  });

  const attendanceRecords = await prisma.attendanceRecord.findMany({
    where: {
      student: { tenantId },
    },
  });

  return {
    exportedAt: new Date().toISOString(),
    schemaVersion: '1.0',
    tenant: {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      status: tenant.status,
      plan: tenant.plan.name,
      branding: tenant.branding,
      pinPrice: Number(tenant.pinPrice),
      blockPromotionOnFeeBalance: tenant.blockPromotionOnFeeBalance,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
      domainAliases: tenant.domainAliases,
      featureOverrides: tenant.featureOverrides,
    },
    academicSessions: academicSessions.map((s: any) => ({
      id: s.id,
      label: s.label,
      startDate: s.startDate,
      endDate: s.endDate,
      isCurrent: s.isCurrent,
      terms: s.terms.map((t: any) => ({
        id: t.id,
        name: t.name,
        startDate: t.startDate,
        endDate: t.endDate,
        isCurrent: t.isCurrent,
        totalSchoolDays: t.totalSchoolDays,
      })),
    })),
    staff: staff.map((st: any) => ({
      id: st.id,
      name: st.name,
      roleBase: st.roleBase,
      contactInfo: st.contactInfo,
      createdAt: st.createdAt,
    })),
    students: students.map((s: any) => ({
      id: s.id,
      name: s.name,
      guardianContactInfo: s.guardianContactInfo,
      createdAt: s.createdAt,
      enrollments: s.enrollments.map((e: any) => ({
        id: e.id,
        sessionLabel: e.session.label,
        className: e.classLevel.name,
        status: e.status,
      })),
    })),
    academicResults: resultEntries.map((r: any) => ({
      id: r.id,
      studentId: r.studentId,
      studentName: r.student.name,
      termName: r.term.name,
      subjectName: r.subject.name,
      caScore: r.caScore !== null ? Number(r.caScore) : null,
      examScore: r.examScore !== null ? Number(r.examScore) : null,
      totalScore: r.totalScore !== null ? Number(r.totalScore) : null,
      grade: r.grade,
      status: r.status,
      comment: r.comment,
    })),
    resultPins: resultPins.map((p: any) => ({
      id: p.id,
      studentId: p.studentId,
      termId: p.termId,
      code: p.code,
      pricePaid: Number(p.pricePaid),
      status: p.status,
      createdAt: p.createdAt,
    })),
    feeItems: feeItems.map((f: any) => ({
      id: f.id,
      name: f.name,
      termName: f.term.name,
      className: f.classLevel ? f.classLevel.name : 'All Classes',
      amount: Number(f.amount),
    })),
    feeAdjustments: studentFeeAdjustments.map((a: any) => ({
      id: a.id,
      studentId: a.studentId,
      studentName: a.student.name,
      feeItemName: a.feeItem.name,
      adjustmentType: a.adjustmentType,
      amountOrPercent: Number(a.amountOrPercent),
    })),
    feePayments: feePayments.map((p: any) => ({
      id: p.id,
      studentId: p.studentId,
      studentName: p.student.name,
      termName: p.term.name,
      amount: Number(p.amount),
      method: p.method,
      paymentRef: p.paymentRef,
      paidAt: p.paidAt,
    })),
    attendanceRecords: attendanceRecords.map((a: any) => ({
      id: a.id,
      studentId: a.studentId,
      termId: a.termId,
      date: a.date,
      status: a.status,
    })),
    siteContents: siteContents,
    notifications: notifications,
  };
}

/**
 * Formats tenant student roster & guardian info as CSV string (§11.8).
 */
export async function exportTenantStudentsCSV(tenantId: string): Promise<string> {
  const students = await prisma.student.findMany({
    where: { tenantId },
    include: {
      enrollments: {
        include: { classLevel: true, session: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { name: 'asc' },
  });

  const headers = [
    'Student ID',
    'Student Name',
    'Current Class',
    'Current Session',
    'Enrollment Status',
    'Guardian Info',
    'Date Registered',
  ];

  const rows = students.map((s: any) => {
    const latestEnrollment = s.enrollments[0];
    const guardianInfo = s.guardianContactInfo ? JSON.stringify(s.guardianContactInfo) : '';
    return [
      s.id,
      s.name,
      latestEnrollment?.classLevel?.name || 'N/A',
      latestEnrollment?.session?.label || 'N/A',
      latestEnrollment?.status || 'N/A',
      guardianInfo,
      s.createdAt.toISOString().split('T')[0],
    ];
  });

  return toCSV(headers, rows);
}

/**
 * Formats tenant academic results broadsheet as CSV string (§11.8).
 */
export async function exportTenantResultsCSV(tenantId: string): Promise<string> {
  const resultEntries = await prisma.resultEntry.findMany({
    where: {
      student: { tenantId },
    },
    include: {
      student: { select: { id: true, name: true } },
      term: { select: { name: true, session: { select: { label: true } } } },
      subject: { select: { name: true } },
    },
    orderBy: [{ termId: 'asc' }, { studentId: 'asc' }],
  });

  const headers = [
    'Result ID',
    'Student ID',
    'Student Name',
    'Session',
    'Term',
    'Subject Name',
    'CA Score',
    'Exam Score',
    'Total Score',
    'Grade',
    'Status',
    'Comment',
  ];

  const rows = resultEntries.map((r: any) => [
    r.id,
    r.studentId,
    r.student.name,
    r.term.session.label,
    r.term.name,
    r.subject.name,
    r.caScore !== null ? Number(r.caScore) : '',
    r.examScore !== null ? Number(r.examScore) : '',
    r.totalScore !== null ? Number(r.totalScore) : '',
    r.grade || '',
    r.status,
    r.comment || '',
  ]);

  return toCSV(headers, rows);
}

/**
 * Formats tenant fee payments & transaction history as CSV string (§11.8).
 */
export async function exportTenantFeesCSV(tenantId: string): Promise<string> {
  const feePayments = await prisma.feePayment.findMany({
    where: {
      student: { tenantId },
    },
    include: {
      student: { select: { id: true, name: true } },
      term: { select: { name: true, session: { select: { label: true } } } },
    },
    orderBy: { paidAt: 'desc' },
  });

  const headers = [
    'Payment ID',
    'Student ID',
    'Student Name',
    'Session',
    'Term',
    'Amount (NGN)',
    'Payment Method',
    'Payment Reference',
    'Paid Date',
  ];

  const rows = feePayments.map((p: any) => [
    p.id,
    p.studentId,
    p.student.name,
    p.term.session.label,
    p.term.name,
    Number(p.amount),
    p.method,
    p.paymentRef || 'N/A',
    p.paidAt.toISOString(),
  ]);

  return toCSV(headers, rows);
}
