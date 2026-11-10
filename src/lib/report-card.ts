import prisma from './prisma';
import { findStudentByIdOrAdmissionNo } from './student-resolver';
import { computeAttendanceStats } from './attendance';
import { getTenantCurriculum, resolveStudentSubjectIds } from './curriculum';
import {
  AFFECTIVE_TRAITS,
  PSYCHOMOTOR_TRAITS,
  normalizeTraitRatings,
} from './report-card-domains';

export interface ReportCardBranding {
  primaryColor: string;
  accentColor: string;
  logoUrl: string | null;
  fontHeading: string;
  fontBody: string;
}

export interface ReportCardSchool {
  id: string;
  name: string;
  slug: string;
  address: string;
  phone: string;
  email: string;
  branding: ReportCardBranding;
}

export interface ReportCardStudent {
  id: string;
  name: string;
  admissionNumber?: string | null;
  gender: string;
  dob: string;
  age: string;
  height: string;
  weight: string;
  club: string;
  favColor: string;
  avatarUrl: string | null;
  classLevel: {
    id: string;
    name: string;
    orderIndex: number;
  };
  session: {
    id: string;
    label: string;
  };
  term: {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
    totalSchoolDays: number | null;
  };
}

export interface ReportCardSubjectResult {
  subjectId: string;
  subjectName: string;
  teacherName: string;
  scores: Record<string, number | string>;
  total: number;
  grade: string; // The frozen letter grade from ResultEntry.grade
  remark: string;
  comment: string | null;
  classAverage: number;
  highestScore: number;
  lowestScore: number;
  subjectPosition: number | null;
}

export interface ReportCardGradingScaleItem {
  grade: string;
  minScore: number;
  maxScore: number;
  remark: string;
}

export interface DomainItem {
  name: string;
  score: number | null; // 1 to 5, null until the form teacher rates the trait
}

export interface ReportCardGradeAnalysis {
  distribution: Array<{ grade: string; count: number }>;
  totalSubjects: number;
}

export interface ReportCardData {
  school: ReportCardSchool;
  student: ReportCardStudent;
  assessmentComponents: Array<{
    id: string;
    name: string;
    maxScore: number;
    weightPercent: number;
  }>;
  subjects: ReportCardSubjectResult[];
  summary: {
    totalScore: number;
    totalObtainable: number;
    averageScore: number;
    overallGrade: string;
    overallRemark: string;
    subjectsCount: number;
    classSize: number;
    position: number | null;
  };
  attendance: {
    presentDays: number;
    absentDays: number;
    lateDays: number;
    totalSchoolDays: number | null;
    percentage: number | null;
    formatted: string;
  };
  review: {
    formTeacherName: string;
    formTeacherRemarks: string | null;
    principalName: string;
    principalRemarks: string | null;
    submittedAt: Date | null;
  };
  domains: {
    affective: DomainItem[];
    psychomotor: DomainItem[];
  };
  gradeAnalysis: ReportCardGradeAnalysis;
  nextTermBegins: string;
  gradingScale: ReportCardGradingScaleItem[];
  publishedAt: Date;
}

/**
 * Derives a standard principal remark based on student average score.
 */
function derivePrincipalRemark(average: number): string {
  if (average >= 80) return 'Exceptional academic excellence. Commendable performance!';
  if (average >= 70) return 'Very good result. Keep up the high standard.';
  if (average >= 60) return 'Good performance. Continue working hard for better results.';
  if (average >= 50) return 'Fair performance. More effort and concentration required.';
  return 'Weak performance. Needs intensive study and remediation next term.';
}

/**
 * Assembles a student's official Report Card (§5.2, §5.3A, §11.7, §13.6).
 *
 * Strict PRD rules enforced:
 * 1. ONLY published results are readable (§5.4). If unpublished or missing, throws an Error.
 * 2. Renders frozen `ResultEntry.grade` directly; never recomputes against live scale (§5A.7).
 * 3. Attendance is computed dynamically at read time from the ledger (§5.3A).
 * 4. Tenant isolation: returns only tenant-scoped data with that tenant's branding (§3.4, §11.1).
 */
export async function generateStudentReportCard(
  tenantId: string,
  studentId: string,
  termId: string
): Promise<ReportCardData> {
  // 1. Fetch Tenant & Branding
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });
  if (!tenant) {
    throw new Error('Tenant not found');
  }

  const brandingRaw = tenant.branding as any;
  const branding: ReportCardBranding = {
    primaryColor: brandingRaw?.primaryColor || '#0F172A',
    accentColor: brandingRaw?.accentColor || '#2563EB',
    logoUrl: brandingRaw?.logoUrl || null,
    fontHeading: brandingRaw?.fontHeading || 'Inter',
    fontBody: brandingRaw?.fontBody || 'Inter',
  };

  // Fetch Tenant Contact Details from SiteContent or branding
  const contactContentDoc = await prisma.siteContent.findUnique({
    where: {
      tenantId_page: {
        tenantId,
        page: 'contact',
      },
    },
  });
  const contactContent = (contactContentDoc?.content as Record<string, any>) || {};

  const schoolAddress =
    brandingRaw?.address ||
    contactContent.address ||
    '14 Davis Cole Crescent, Surulere, Lagos State, Nigeria';
  const schoolPhone =
    brandingRaw?.phone ||
    contactContent.phone ||
    '08115414915, 07064852256';
  const schoolEmail =
    brandingRaw?.email ||
    contactContent.email ||
    `info@${tenant.slug}.edu.ng`;

  const cleanStudentIdentifier = studentId.trim();

  // 2. Fetch Student with Tenant Isolation (supports either primary key ID or official admissionNumber)
  const student = await findStudentByIdOrAdmissionNo(tenantId, cleanStudentIdentifier);
  if (!student || student.tenantId !== tenantId) {
    throw new Error('Student not found or unauthorized');
  }

  const canonicalStudentId = student.id;

  // Extract Student Bio Information
  const guardianInfo = (student.guardianContactInfo as Record<string, any>) || {};
  const studentGender = String(guardianInfo.gender || '—').toUpperCase();

  let studentDob = '—';
  if (guardianInfo.dob) {
    try {
      const parsedDob = new Date(guardianInfo.dob);
      if (Number.isNaN(parsedDob.getTime())) throw new Error('Invalid date');
      studentDob = parsedDob.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      studentDob = String(guardianInfo.dob);
    }
  }

  let studentAge = guardianInfo.age ? `${guardianInfo.age}yrs` : '—';
  if (!guardianInfo.age && guardianInfo.dob) {
    const birthDate = new Date(guardianInfo.dob);
    if (!Number.isNaN(birthDate.getTime())) {
      const now = new Date();
      let age = now.getFullYear() - birthDate.getFullYear();
      if (now.getMonth() < birthDate.getMonth() || (now.getMonth() === birthDate.getMonth() && now.getDate() < birthDate.getDate())) age -= 1;
      if (age >= 0 && age < 120) studentAge = `${age}yrs`;
    }
  }
  const studentHeight = guardianInfo.height || guardianInfo.ht || '—';
  const studentWeight = guardianInfo.weight || guardianInfo.wt || '—';
  const studentClub = guardianInfo.club || guardianInfo.society || '—';
  const studentFavColor = guardianInfo.favColor || guardianInfo.favoriteColor || '—';
  const studentAvatarUrl = guardianInfo.avatarUrl || (student as any).avatarUrl || null;

  // 3. Fetch Term and Session
  const term = await prisma.term.findUnique({
    where: { id: termId },
  });
  if (!term) {
    throw new Error('Term not found or unauthorized');
  }
  const session = await prisma.academicSession.findUnique({
    where: { id: term.sessionId },
  });
  if (!session || session.tenantId !== tenantId) {
    throw new Error('Term not found or unauthorized');
  }

  // 4. Fetch Active Enrollment for this Session
  const enrollment = await prisma.enrollment.findUnique({
    where: {
      studentId_sessionId: {
        studentId: canonicalStudentId,
        sessionId: term.sessionId,
      },
    },
  });
  if (!enrollment || enrollment.status !== 'active') {
    throw new Error('Student has no active enrollment in this academic session');
  }

  const classLevel = await prisma.classLevel.findUnique({
    where: { id: enrollment.classLevelId },
  });
  if (!classLevel) {
    throw new Error('Class level not found');
  }

  // 5. Fetch Result Entries for this Student & Term
  const rawEntries = await prisma.resultEntry.findMany({
    where: {
      studentId: canonicalStudentId,
      termId,
    },
  });

  if (rawEntries.length === 0) {
    throw new Error('No results found for this student in the specified term.');
  }

  const curriculum = await getTenantCurriculum(tenantId);
  const validSubjectIds = new Set(
    resolveStudentSubjectIds({
      classLevelId: classLevel.id,
      classLevel,
      curriculum,
      studentContactInfo: student.guardianContactInfo,
    })
  );

  // If a curriculum is configured with offerings, filter out any rogue/out-of-track entries
  const eligibleRawEntries = validSubjectIds.size > 0
    ? rawEntries.filter((e: any) => validSubjectIds.has(e.subjectId))
    : rawEntries;

  if (eligibleRawEntries.length === 0) {
    throw new Error('No results found for this student in the specified term.');
  }

  const subjectIds = Array.from(new Set(eligibleRawEntries.map((e: any) => e.subjectId))).filter(Boolean);
  const teacherIds = Array.from(new Set(eligibleRawEntries.map((e: any) => e.teacherId))).filter(Boolean);

  const [subjectsList, teachersList] = await Promise.all([
    subjectIds.length > 0 ? prisma.subject.findMany({ where: { id: { in: subjectIds } } }) : [],
    teacherIds.length > 0 ? prisma.staff.findMany({ where: { id: { in: teacherIds } } }) : [],
  ]);

  const subjectMap = new Map(subjectsList.map((s: any) => [s.id, s]));
  const teacherMap = new Map(teachersList.map((t: any) => [t.id, t]));

  const studentEntries = eligibleRawEntries.map((e: any) => ({
    ...e,
    subject: subjectMap.get(e.subjectId) || { name: 'Unknown' },
    teacher: teacherMap.get(e.teacherId) || { name: 'Staff' },
  })).sort((a: any, b: any) => (a.subject.name || '').localeCompare(b.subject.name || ''));

  // §5.4: Strictly enforce that ALL entries must be in 'published' status!
  const unpublishedEntries = studentEntries.filter((e: any) => e.status !== 'published');
  if (unpublishedEntries.length > 0) {
    throw new Error(
      `Cannot generate report card: Results have not been published by the school admin. Current status: ${unpublishedEntries[0].status}.`
    );
  }

  // 6. Fetch Active Assessment Components for the Term
  let components = await prisma.assessmentComponent.findMany({
    where: { tenantId, termId },
    orderBy: { orderIndex: 'asc' },
  });
  if (components.length === 0) {
    components = await prisma.assessmentComponent.findMany({
      where: { tenantId, termId: null },
      orderBy: { orderIndex: 'asc' },
    });
  }

  // 7. Fetch Applicable Grading Scale for Class Level Legend
  const rawGradingScales = await prisma.gradingScale.findMany({
    where: { tenantId },
    orderBy: { minScore: 'desc' },
  });

  const scaleClassIds = Array.from(new Set([
    ...rawGradingScales.map((gs: any) => gs.lowestClassLevelId),
    ...rawGradingScales.map((gs: any) => gs.highestClassLevelId),
  ])).filter(Boolean);

  const scaleClassLevels = scaleClassIds.length > 0
    ? await prisma.classLevel.findMany({ where: { id: { in: scaleClassIds } } })
    : [];
  const scaleClassMap = new Map(scaleClassLevels.map((c: any) => [c.id, c]));

  const allGradingScales = rawGradingScales.map((gs: any) => ({
    ...gs,
    lowestClassLevel: scaleClassMap.get(gs.lowestClassLevelId) || { orderIndex: 0 },
    highestClassLevel: scaleClassMap.get(gs.highestClassLevelId) || { orderIndex: 99 },
  }));

  const classGradingScales = allGradingScales.filter((gs: any) => {
    return (
      gs.lowestClassLevel.orderIndex <= classLevel.orderIndex &&
      gs.highestClassLevel.orderIndex >= classLevel.orderIndex
    );
  });

  const seenLegendGrades = new Set<string>();
  const gradingScaleLegend: ReportCardGradingScaleItem[] = classGradingScales
    .filter((gs: any) => {
      if (seenLegendGrades.has(gs.grade)) return false;
      seenLegendGrades.add(gs.grade);
      return true;
    })
    .map((gs: any) => ({
      grade: gs.grade,
      minScore: Number(gs.minScore),
      maxScore: Number(gs.maxScore),
      remark: gs.remark,
    }));

  // Quick lookup from grade/score to remark
  function resolveRemark(scoreTotal: number, frozenGrade: string | null): string {
    if (frozenGrade) {
      const match = classGradingScales.find((gs: typeof classGradingScales[number]) => gs.grade === frozenGrade);
      if (match) return match.remark;
    }
    const match = classGradingScales.find(
      (gs: typeof classGradingScales[number]) => scoreTotal >= Number(gs.minScore) && scoreTotal <= Number(gs.maxScore)
    );
    return match ? match.remark : 'Satisfactory';
  }

  // 8. Fetch Classmates for Class Statistics (Rank, Class Average, Subject Rank)
  const classEnrollments = await prisma.enrollment.findMany({
    where: {
      classLevelId: classLevel.id,
      sessionId: term.sessionId,
      status: 'active',
    },
    select: {
      studentId: true,
      student: { select: { guardianContactInfo: true } },
    },
  });

  const classStudentIds = classEnrollments.map((e: any) => e.studentId);
  const classSize = classStudentIds.length;

  const allClassEntries = await prisma.resultEntry.findMany({
    where: {
      termId,
      studentId: { in: classStudentIds },
      status: 'published',
    },
  });

  // Map each student in the class to their set of valid curriculum subject IDs
  const studentValidSubjectSetMap = new Map<string, Set<string>>();
  for (const ce of classEnrollments) {
    const ids = resolveStudentSubjectIds({
      classLevelId: classLevel.id,
      classLevel,
      curriculum,
      studentContactInfo: ce.student?.guardianContactInfo,
    });
    studentValidSubjectSetMap.set(ce.studentId, new Set(ids));
  }

  // Filter out-of-track entries so they do not contaminate classmates' stats or ranking
  const validClassEntries = allClassEntries.filter((entry: any) => {
    const validSet = studentValidSubjectSetMap.get(entry.studentId);
    return !validSet || validSet.size === 0 || validSet.has(entry.subjectId);
  });

  // Calculate per-subject stats (Average, High, Low) & student subject ranking
  const subjectStatsMap = new Map<
    string,
    { sum: number; count: number; high: number; low: number }
  >();

  const subjectStudentScoresMap = new Map<string, Array<{ studentId: string; total: number }>>();

  for (const entry of validClassEntries) {
    const total =
      entry.scoreData && typeof (entry.scoreData as any).total === 'number'
        ? (entry.scoreData as any).total
        : 0;

    const current = subjectStatsMap.get(entry.subjectId) || {
      sum: 0,
      count: 0,
      high: -Infinity,
      low: Infinity,
    };

    current.sum += total;
    current.count += 1;
    if (total > current.high) current.high = total;
    if (total < current.low) current.low = total;

    subjectStatsMap.set(entry.subjectId, current);

    const scoresList = subjectStudentScoresMap.get(entry.subjectId) || [];
    scoresList.push({ studentId: entry.studentId, total });
    subjectStudentScoresMap.set(entry.subjectId, scoresList);
  }

  // Compute subject position map: subjectId -> Map<studentId, rank>
  const subjectPositionsMap = new Map<string, Map<string, number>>();
  for (const [subjId, list] of subjectStudentScoresMap.entries()) {
    list.sort((a, b) => b.total - a.total);
    const ranks = new Map<string, number>();
    list.forEach((item, idx) => {
      ranks.set(item.studentId, idx + 1);
    });
    subjectPositionsMap.set(subjId, ranks);
  }

  // Calculate student ranks across the entire class
  const studentTotalsMap = new Map<string, { totalScore: number; subjectCount: number }>();
  for (const entry of validClassEntries) {
    const total =
      entry.scoreData && typeof (entry.scoreData as any).total === 'number'
        ? (entry.scoreData as any).total
        : 0;

    const current = studentTotalsMap.get(entry.studentId) || { totalScore: 0, subjectCount: 0 };
    current.totalScore += total;
    current.subjectCount += 1;
    studentTotalsMap.set(entry.studentId, current);
  }

  // Sort students descending by average score (with total score as tie-breaker) so Senior Secondary elective tracks are ranked fairly
  const studentRankList = Array.from(studentTotalsMap.entries()).sort((a, b) => {
    const avgA = a[1].subjectCount > 0 ? a[1].totalScore / a[1].subjectCount : 0;
    const avgB = b[1].subjectCount > 0 ? b[1].totalScore / b[1].subjectCount : 0;
    if (Math.abs(avgB - avgA) > 0.0001) {
      return avgB - avgA;
    }
    return b[1].totalScore - a[1].totalScore;
  });

  let studentPosition: number | null = null;
  const rankIndex = studentRankList.findIndex(([sid]) => sid === canonicalStudentId);
  if (rankIndex !== -1) {
    studentPosition = rankIndex + 1;
  }

  // 9. Assemble Subject Results
  let studentTotalScore = 0;
  const subjects: ReportCardSubjectResult[] = studentEntries.map((entry: any) => {
    const scoreObj = (entry.scoreData as Record<string, any>) || {};
    const total = typeof scoreObj.total === 'number' ? scoreObj.total : 0;
    studentTotalScore += total;

    // Strict PRD contract (§5A.7): Render the stored frozen grade!
    const frozenGrade = entry.grade || 'N/A';
    const remark = resolveRemark(total, entry.grade);

    const sStats = subjectStatsMap.get(entry.subjectId);
    const classAvg =
      sStats && sStats.count > 0 ? Math.round((sStats.sum / sStats.count) * 10) / 10 : total;
    const highest = sStats && sStats.high !== -Infinity ? sStats.high : total;
    const lowest = sStats && sStats.low !== Infinity ? sStats.low : total;

    const subjPos = subjectPositionsMap.get(entry.subjectId)?.get(canonicalStudentId) || null;

    return {
      subjectId: entry.subjectId,
      subjectName: entry.subject.name,
      teacherName: entry.teacher.name,
      scores: scoreObj,
      total,
      grade: frozenGrade,
      remark,
      comment: entry.comment,
      classAverage: classAvg,
      highestScore: highest,
      lowestScore: lowest,
      subjectPosition: subjPos,
    };
  });

  const subjectsCount = subjects.length;
  const totalObtainable = subjectsCount * 100;
  const averageScore =
    subjectsCount > 0 ? Math.round((studentTotalScore / subjectsCount) * 10) / 10 : 0;

  // Grade Analysis Distribution
  const gradeDistributionMap: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
  for (const s of subjects) {
    const gKey = (s.grade || 'F').charAt(0).toUpperCase();
    if (gradeDistributionMap[gKey] !== undefined) {
      gradeDistributionMap[gKey] += 1;
    } else {
      gradeDistributionMap['F'] += 1;
    }
  }

  const gradeAnalysis: ReportCardGradeAnalysis = {
    distribution: ['A', 'B', 'C', 'D', 'E', 'F'].map((grade) => ({
      grade,
      count: gradeDistributionMap[grade],
    })),
    totalSubjects: subjectsCount,
  };

  // Determine overall letter grade and remark
  let overallGrade = 'A';
  if (averageScore >= 70) overallGrade = 'A';
  else if (averageScore >= 60) overallGrade = 'B';
  else if (averageScore >= 50) overallGrade = 'C';
  else if (averageScore >= 45) overallGrade = 'D';
  else if (averageScore >= 40) overallGrade = 'E';
  else overallGrade = 'F';

  const overallRemark = resolveRemark(averageScore, overallGrade);

  // 10. Ledger Attendance Stats (§5.3A)
  const attendanceStats = await computeAttendanceStats(canonicalStudentId, termId);
  const formattedAttendance = `${attendanceStats.presentDays} / ${attendanceStats.totalSchoolDays || '-'
    } days (${attendanceStats.percentage !== null ? `${attendanceStats.percentage}%` : 'N/A'
    })`;

  // 11. Form Teacher Review & Principal Remarks
  const classReview = await prisma.classResultReview.findUnique({
    where: {
      classLevelId_termId: {
        classLevelId: classLevel.id,
        termId,
      },
    },
  });

  let formTeacherName = 'MR ADIGUN TIMILEYIN';
  if (classReview?.formTeacherId) {
    const ft = await prisma.staff.findUnique({ where: { id: classReview.formTeacherId } });
    if (ft) formTeacherName = ft.name;
  }

  const principalName = brandingRaw?.principalName || 'MR OWOLABI BADMOS';

  // 12. Teacher-entered, term-specific affective & psychomotor ratings & individual remarks.
  const domainAssessment = await prisma.reportCardAssessment.findFirst({
    where: {
      tenantId,
      studentId: canonicalStudentId,
      classLevelId: classLevel.id,
      termId,
    },
    select: { affectiveRatings: true, psychomotorRatings: true },
  });
  const affectiveRatings = normalizeTraitRatings(domainAssessment?.affectiveRatings, AFFECTIVE_TRAITS);
  const psychomotorRatings = normalizeTraitRatings(domainAssessment?.psychomotorRatings, PSYCHOMOTOR_TRAITS);

  const affectiveDomain: DomainItem[] = AFFECTIVE_TRAITS.map((trait) => ({
    name: trait,
    score: affectiveRatings[trait],
  }));

  const psychomotorDomain: DomainItem[] = PSYCHOMOTOR_TRAITS.map((trait) => ({
    name: trait,
    score: psychomotorRatings[trait],
  }));

  // Next term resumption date
  const nextTerm = await prisma.term.findFirst({
    where: {
      sessionId: term.sessionId,
      startDate: { gt: term.endDate },
    },
    orderBy: { startDate: 'asc' },
  });

  const nextTermBegins = nextTerm
    ? nextTerm.startDate.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
    : new Date(term.endDate.getTime() + 28 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

  const latestPublishDate = studentEntries.reduce((latest: any, e: any) => {
    return e.updatedAt > latest ? e.updatedAt : latest;
  }, studentEntries[0].updatedAt);

  return {
    school: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      address: schoolAddress,
      phone: schoolPhone,
      email: schoolEmail,
      branding,
    },
    student: {
      id: student.id,
      name: student.name,
      admissionNumber: student.admissionNumber || (guardianInfo.admissionNo as string) || null,
      gender: studentGender,
      dob: studentDob,
      age: studentAge,
      height: studentHeight,
      weight: studentWeight,
      club: studentClub,
      favColor: studentFavColor,
      avatarUrl: studentAvatarUrl,
      classLevel: {
        id: classLevel.id,
        name: classLevel.name,
        orderIndex: classLevel.orderIndex,
      },
      session: {
        id: session.id,
        label: session.label,
      },
      term: {
        id: term.id,
        name: term.name,
        startDate: term.startDate,
        endDate: term.endDate,
        totalSchoolDays: term.totalSchoolDays,
      },
    },
    assessmentComponents: components.map((c: typeof components[number]) => ({
      id: c.id,
      name: c.name,
      maxScore: c.maxScore,
      weightPercent: Number(c.weightPercent),
    })),
    subjects,
    summary: {
      totalScore: studentTotalScore,
      totalObtainable,
      averageScore,
      overallGrade,
      overallRemark,
      subjectsCount,
      classSize,
      position: studentPosition,
    },
    attendance: {
      ...attendanceStats,
      formatted: formattedAttendance,
    },
    review: {
      formTeacherName,
      formTeacherRemarks:
        (() => {
          const rawAff = (domainAssessment?.affectiveRatings && typeof domainAssessment.affectiveRatings === 'object')
            ? (domainAssessment.affectiveRatings as Record<string, any>)
            : undefined;
          if (typeof rawAff?._remarks === 'string' && rawAff._remarks.trim()) {
            return rawAff._remarks.trim();
          }
          if (typeof (domainAssessment as any)?.remarks === 'string' && (domainAssessment as any).remarks.trim()) {
            return (domainAssessment as any).remarks.trim();
          }
          return (
            classReview?.overallRemarks ||
            `${student.name.split(' ')[0]} is a bright, diligent and studious student. Always inquisitive and ready to learn.`
          );
        })(),
      principalName,
      principalRemarks: derivePrincipalRemark(averageScore),
      submittedAt: classReview?.submittedToAdminAt || null,
    },
    domains: {
      affective: affectiveDomain,
      psychomotor: psychomotorDomain,
    },
    gradeAnalysis,
    nextTermBegins,
    gradingScale: gradingScaleLegend,
    publishedAt: latestPublishDate,
  };
}

/**
 * Assembles official Report Cards for all active students in a class (§5.2, §13.6).
 * Used for batch printing and class-wide performance overviews.
 */
export async function generateClassReportCards(
  tenantId: string,
  classLevelId: string,
  termId: string
): Promise<ReportCardData[]> {
  const term = await prisma.term.findUnique({
    where: { id: termId },
  });
  if (!term) throw new Error('Term not found');

  const session = await prisma.academicSession.findUnique({
    where: { id: term.sessionId },
  });
  if (!session || session.tenantId !== tenantId) {
    throw new Error('Term not found or unauthorized');
  }

  const rawEnrollments = await prisma.enrollment.findMany({
    where: {
      classLevelId,
      sessionId: term.sessionId,
      status: 'active',
    },
  });

  const studentIds = rawEnrollments.map((e: any) => e.studentId);
  const students = studentIds.length > 0
    ? await prisma.student.findMany({
      where: { id: { in: studentIds }, tenantId },
    })
    : [];

  const studentMap = new Map(students.map((s: any) => [s.id, s]));
  const enrollments = rawEnrollments
    .filter((e: any) => studentMap.has(e.studentId))
    .map((e: any) => ({
      ...e,
      student: studentMap.get(e.studentId)!,
    }))
    .sort((a: any, b: any) => (a.student.name || '').localeCompare(b.student.name || ''));

  const reportCards: ReportCardData[] = [];
  for (const enr of enrollments) {
    try {
      const rc = await generateStudentReportCard(tenantId, enr.studentId, termId);
      reportCards.push(rc);
    } catch (err: any) {
      // If a student's results are not published yet, skip
      continue;
    }
  }

  return reportCards;
}
