/**
 * Module 5 Verification — Result Entry Status Machine (§5.2) & Attendance (§5.3A)
 *
 * Tests the following PRD requirements:
 *  §5.2   Result entry status machine: not_started → submitted → form_teacher_reviewed → published
 *  §5.2   Teacher score entry computes total dynamically and moves status to submitted
 *  §5.2   Broadsheet submission coverage: form teacher review is strictly blocked until 100% of required subjects are submitted
 *  §5.2   Form teacher review transitions all class entries to form_teacher_reviewed
 *  §5A.7  Admin publish freezes letter grade permanently into ResultEntry.grade; never retroactively mutated by later scale edits
 *  §5.3A  Daily attendance marking and term lock once results are published
 *  §5.3A  Attendance percentage is computed at read time (ledger-not-cache) from AttendanceRecord ÷ Term.totalSchoolDays
 *  §5.2   Admin reopen action unlocks results and creates a mandatory ResultAuditLog record
 *  §11.1  Multi-tenant query isolation on results, reviews, attendance, and audit logs
 *
 * Run: npx tsx tests/verify_module5.ts
 */

import 'dotenv/config';
import prisma from '../src/lib/prisma';
import { getTenantDb } from '../src/lib/tenant-db';
import {
  saveSubjectScores,
  checkClassSubmissionCoverage,
  submitFormTeacherReview,
  publishClassResults,
  reopenClassResults,
} from '../src/lib/results';
import {
  markDailyAttendance,
  computeAttendanceStats,
} from '../src/lib/attendance';

let passed = 0;
let failed = 0;

function ok(label: string) {
  console.log(`  ✅ PASS  ${label}`);
  passed++;
}

function fail(label: string, reason: string) {
  console.error(`  ❌ FAIL  ${label}`);
  console.error(`           ${reason}`);
  failed++;
}

async function run() {
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  Module 5 — Result Entry Status Machine (§5.2) & Attendance (§5.3A)');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // 1. Fetch seed tenants & context
  const apex = await prisma.tenant.findUnique({
    where: { slug: 'apex' },
  });
  const beacon = await prisma.tenant.findUnique({
    where: { slug: 'beacon' },
  });

  if (!apex || !beacon) {
    console.error('FATAL: Seed data missing. Run `npm run db:seed` first.');
    process.exit(1);
  }

  const session = await prisma.academicSession.findFirst({
    where: { tenantId: apex.id, isCurrent: true },
    include: { terms: { where: { isCurrent: true }, take: 1 } },
  });
  if (!session || session.terms.length === 0) {
    console.error('FATAL: Active session or term missing for Apex.');
    process.exit(1);
  }
  const term = session.terms[0];

  // Set totalSchoolDays on term if not set (§5.3A denominator)
  await prisma.term.update({
    where: { id: term.id },
    data: { totalSchoolDays: 60 },
  });

  // Pick a class with students and teaching assignments (e.g. SSS 2)
  const sss2 = await prisma.classLevel.findUnique({ where: { name: 'SSS 2' } });
  if (!sss2) throw new Error('SSS 2 class level missing');

  const sss2Students = await prisma.enrollment.findMany({
    where: { classLevelId: sss2.id, sessionId: session.id, status: 'active' },
    include: { student: true },
  });
  if (sss2Students.length === 0) throw new Error('No students enrolled in SSS 2');

  const sss2Assignments = await prisma.teachingAssignment.findMany({
    where: { classLevelId: sss2.id, sessionId: session.id },
    include: { subject: true, staff: true },
  });
  if (sss2Assignments.length === 0) throw new Error('No teaching assignments for SSS 2');

  const formTeacherAssignment = await prisma.formTeacherAssignment.findFirst({
    where: { classLevelId: sss2.id, sessionId: session.id },
    include: { staff: true },
  });
  if (!formTeacherAssignment) throw new Error('No form teacher assigned for SSS 2');

  const adminUser = await prisma.tenantUser.findFirst({
    where: { tenantId: apex.id, role: 'school_admin' },
  });
  if (!adminUser) throw new Error('Apex admin user missing');

  // Clean previous result entries for this test class & term to ensure deterministic run
  await prisma.resultEntry.deleteMany({
    where: {
      termId: term.id,
      studentId: { in: sss2Students.map((s) => s.studentId) },
    },
  });
  await prisma.classResultReview.deleteMany({
    where: {
      classLevelId: sss2.id,
      termId: term.id,
    },
  });
  await prisma.attendanceRecord.deleteMany({
    where: {
      termId: term.id,
      studentId: { in: sss2Students.map((s) => s.studentId) },
    },
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Group 1: Teacher Score Entry & Preview Grade (§5.2, §5A.5)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('[Group 1: Teacher Score Entry & Preview Grade (§5.2, §5A.5)]');

  const firstAssignment = sss2Assignments[0];
  const firstStudent = sss2Students[0];

  // Save scores as draft first
  const draftScores = { '1st CA': 18, '2nd CA': 16, Exam: 54 }; // total = 88
  await saveSubjectScores({
    tenantId: apex.id,
    teacherId: firstAssignment.staffId,
    classLevelId: sss2.id,
    subjectId: firstAssignment.subjectId,
    termId: term.id,
    markAsSubmitted: false,
    entries: [
      {
        studentId: firstStudent.studentId,
        scores: draftScores,
        comment: 'Excellent analytical reasoning',
      },
    ],
  });

  const draftEntry = await prisma.resultEntry.findUnique({
    where: {
      studentId_subjectId_termId: {
        studentId: firstStudent.studentId,
        subjectId: firstAssignment.subjectId,
        termId: term.id,
      },
    },
  });

  if (draftEntry && draftEntry.status === 'not_started') {
    ok('Teacher can save scores as draft with status "not_started"');
  } else {
    fail('Draft status', `Expected not_started, got ${draftEntry?.status}`);
  }

  const draftScoreData = draftEntry?.scoreData as Record<string, any>;
  if (draftScoreData && draftScoreData.total === 88) {
    ok('Calculated total score 88 stored in scoreData.total');
  } else {
    fail('Draft total score', `Expected 88, got ${draftScoreData?.total}`);
  }

  if (draftEntry && draftEntry.grade === null) {
    ok('ResultEntry.grade is null while in draft status (never stored before publish §5A.7)');
  } else {
    fail('Draft grade', `Expected null, got ${draftEntry?.grade}`);
  }

  // Now submit the scores for all students in this first subject
  const subject1Entries = sss2Students.map((s, idx) => ({
    studentId: s.studentId,
    scores: { '1st CA': 15 + (idx % 5), '2nd CA': 16 + (idx % 4), Exam: 50 + (idx % 10) },
    comment: 'Consistent class participation',
  }));

  await saveSubjectScores({
    tenantId: apex.id,
    teacherId: firstAssignment.staffId,
    classLevelId: sss2.id,
    subjectId: firstAssignment.subjectId,
    termId: term.id,
    markAsSubmitted: true,
    entries: subject1Entries,
  });

  const submittedEntry = await prisma.resultEntry.findUnique({
    where: {
      studentId_subjectId_termId: {
        studentId: firstStudent.studentId,
        subjectId: firstAssignment.subjectId,
        termId: term.id,
      },
    },
  });

  if (submittedEntry && submittedEntry.status === 'submitted') {
    ok('Submitting subject scores moves status to "submitted"');
  } else {
    fail('Submitted status', `Expected submitted, got ${submittedEntry?.status}`);
  }

  if (submittedEntry && submittedEntry.grade === null) {
    ok('ResultEntry.grade remains null after submit (still frozen only at publish)');
  } else {
    fail('Submitted grade', `Expected null, got ${submittedEntry?.grade}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Group 2: Form Teacher Submission Coverage Block (§5.2, §5.4)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n[Group 2: Form Teacher Submission Coverage Block (§5.2, §5.4)]');

  // Check coverage when only 1 subject is submitted
  const coveragePartial = await checkClassSubmissionCoverage(apex.id, sss2.id, term.id);
  if (!coveragePartial.isComplete && coveragePartial.missingCount > 0) {
    ok(`Coverage correctly reports incomplete (${coveragePartial.missingCount} missing scores across remaining subjects)`);
  } else {
    fail('Partial coverage check', `Expected incomplete, got complete`);
  }

  // Attempt to submit form teacher review prematurely
  let reviewBlocked = false;
  try {
    await submitFormTeacherReview({
      tenantId: apex.id,
      formTeacherId: formTeacherAssignment.staffId,
      classLevelId: sss2.id,
      termId: term.id,
      overallRemarks: 'Premature review attempt',
    });
  } catch (err: any) {
    reviewBlocked = true;
  }

  if (reviewBlocked) {
    ok('PRD §5.2 / §5.4 enforced: submitFormTeacherReview is blocked server-side when any subject is incomplete');
  } else {
    fail('Form teacher review block', 'Expected submitFormTeacherReview to throw error when subjects are missing');
  }

  // Submit all remaining assigned subjects for SSS 2
  for (let i = 1; i < sss2Assignments.length; i++) {
    const a = sss2Assignments[i];
    const entries = sss2Students.map((s, idx) => ({
      studentId: s.studentId,
      scores: { '1st CA': 18, '2nd CA': 17, Exam: 52 },
      comment: 'Good effort throughout the term',
    }));
    await saveSubjectScores({
      tenantId: apex.id,
      teacherId: a.staffId,
      classLevelId: sss2.id,
      subjectId: a.subjectId,
      termId: term.id,
      markAsSubmitted: true,
      entries,
    });
  }

  const coverageFull = await checkClassSubmissionCoverage(apex.id, sss2.id, term.id);
  if (coverageFull.isComplete && coverageFull.missingCount === 0) {
    ok(`All assigned subjects submitted: coverage reports 100% complete (${coverageFull.submittedCount}/${coverageFull.totalExpected})`);
  } else {
    fail('Full coverage check', `Expected 100% complete, got missing: ${coverageFull.missingCount}`);
  }

  // Now submit form teacher review
  const reviewResult = await submitFormTeacherReview({
    tenantId: apex.id,
    formTeacherId: formTeacherAssignment.staffId,
    classLevelId: sss2.id,
    termId: term.id,
    overallRemarks: 'An outstanding term for SSS 2 with remarkable discipline and effort.',
  });

  if (reviewResult && reviewResult.submittedToAdminAt) {
    ok('Form teacher review created with submittedToAdminAt timestamp');
  } else {
    fail('Review submission', 'submittedToAdminAt not set');
  }

  // Check that all class entries moved to form_teacher_reviewed
  const reviewedCount = await prisma.resultEntry.count({
    where: {
      termId: term.id,
      studentId: { in: sss2Students.map((s) => s.studentId) },
      status: 'form_teacher_reviewed',
    },
  });

  if (reviewedCount === coverageFull.totalExpected) {
    ok(`All ${reviewedCount} class result entries transitioned to status "form_teacher_reviewed"`);
  } else {
    fail('Reviewed status transition', `Expected ${coverageFull.totalExpected}, got ${reviewedCount}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Group 3: School Admin Publish & Permanent Grade Freezing (§5.2, §5A.7)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n[Group 3: School Admin Publish & Permanent Grade Freezing (§5.2, §5A.7)]');

  // Verify grade is still null immediately before publish
  const prePublishEntry = await prisma.resultEntry.findFirst({
    where: { termId: term.id, studentId: firstStudent.studentId },
  });
  if (prePublishEntry && prePublishEntry.grade === null) {
    ok('ResultEntry.grade is strictly null prior to admin publish action');
  } else {
    fail('Pre-publish grade check', `Expected null, got ${prePublishEntry?.grade}`);
  }

  // Admin executes publish
  const publishResult = await publishClassResults({
    tenantId: apex.id,
    classLevelId: sss2.id,
    termId: term.id,
  });

  if (publishResult.publishedCount === coverageFull.totalExpected) {
    ok(`Admin published ${publishResult.publishedCount} entries`);
  } else {
    fail('Publish count', `Expected ${coverageFull.totalExpected}, got ${publishResult.publishedCount}`);
  }

  // Verify that all entries now have status = 'published' AND a permanent grade
  const publishedEntries = await prisma.resultEntry.findMany({
    where: {
      termId: term.id,
      studentId: { in: sss2Students.map((s) => s.studentId) },
    },
  });

  const allPublished = publishedEntries.every((e) => e.status === 'published');
  const allGraded = publishedEntries.every((e) => e.grade !== null && ['A', 'B', 'C', 'D', 'E', 'F'].includes(e.grade));

  if (allPublished && allGraded) {
    ok('Every ResultEntry transitioned to "published" and letter grade was permanently frozen');
  } else {
    fail('Published & graded check', `allPublished: ${allPublished}, allGraded: ${allGraded}`);
  }

  const samplePublished = publishedEntries[0];
  const originalGrade = samplePublished.grade;

  // Test freeze guarantee: change GradingScale band temporarily and verify samplePublished.grade NEVER changes
  const originalScaleA = await prisma.gradingScale.findFirst({
    where: { tenantId: apex.id, grade: 'A' },
  });

  if (originalScaleA) {
    // Temporarily mutate scale minScore to 95
    await prisma.gradingScale.update({
      where: { id: originalScaleA.id },
      data: { minScore: 95 },
    });

    // Re-query the published result entry from database
    const fetchedAgain = await prisma.resultEntry.findUnique({
      where: { id: samplePublished.id },
    });

    if (fetchedAgain && fetchedAgain.grade === originalGrade) {
      ok(`PRD §5A.7 verified: modifying active GradingScale does NOT alter frozen grade ("${originalGrade}") on published result`);
    } else {
      fail('Grade freeze contract', `Grade mutated from ${originalGrade} to ${fetchedAgain?.grade}`);
    }

    // Restore original scale minScore
    await prisma.gradingScale.update({
      where: { id: originalScaleA.id },
      data: { minScore: 70 },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Group 4: Daily Attendance Register & Ledger Percentage (§5.3A)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n[Group 4: Daily Attendance Register & Ledger Percentage (§5.3A)]');

  // Since results for SSS 2 are now published, attendance for SSS 2 should be locked!
  let attendanceLocked = false;
  try {
    await markDailyAttendance({
      tenantId: apex.id,
      staffId: formTeacherAssignment.staffId,
      classLevelId: sss2.id,
      termId: term.id,
      date: '2024-10-15',
      records: [{ studentId: firstStudent.studentId, status: 'present' }],
    });
  } catch (err: any) {
    attendanceLocked = true;
  }

  if (attendanceLocked) {
    ok('PRD §5.3A lock verified: attendance editing is blocked once term results are published');
  } else {
    fail('Attendance lock', 'Expected markDailyAttendance to throw error when results are published');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Group 5: School Admin Reopen Action with Audit Logging (§5.2, §5.3A)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n[Group 5: School Admin Reopen Action with Audit Logging (§5.2, §5.3A)]');

  // Attempt reopen without reason
  let reopenBlockedWithoutReason = false;
  try {
    await reopenClassResults({
      tenantId: apex.id,
      userId: adminUser.id,
      classLevelId: sss2.id,
      termId: term.id,
      reason: '',
    });
  } catch {
    reopenBlockedWithoutReason = true;
  }

  if (reopenBlockedWithoutReason) {
    ok('Reopening class results without a valid reason is rejected');
  } else {
    fail('Reopen reason validation', 'Expected error when reason is empty');
  }

  // Execute authorized reopen with audit reason
  const validReason = 'Teacher reported transposing 2nd CA scores on three students';
  const reopenResult = await reopenClassResults({
    tenantId: apex.id,
    userId: adminUser.id,
    classLevelId: sss2.id,
    termId: term.id,
    reason: validReason,
  });

  if (reopenResult.reopenedCount > 0) {
    ok(`Reopened ${reopenResult.reopenedCount} entries back to status "submitted"`);
  } else {
    fail('Reopen execution', 'reopenedCount was 0');
  }

  // Verify audit log record
  const auditLog = await prisma.resultAuditLog.findFirst({
    where: {
      tenantId: apex.id,
      action: 'reopen_results',
      targetId: `${sss2.id}:${term.id}`,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (auditLog && auditLog.reason === validReason && auditLog.userId === adminUser.id) {
    ok(`ResultAuditLog entry created with user ID, action, and verified reason: "${auditLog.reason}"`);
  } else {
    fail('ResultAuditLog verification', `Audit record missing or incorrect: ${JSON.stringify(auditLog)}`);
  }

  // Verify attendance is now unlocked after reopen
  await markDailyAttendance({
    tenantId: apex.id,
    staffId: formTeacherAssignment.staffId,
    classLevelId: sss2.id,
    termId: term.id,
    date: '2024-10-10',
    records: [
      { studentId: firstStudent.studentId, status: 'present' },
      { studentId: sss2Students[1].studentId, status: 'absent' },
    ],
  });

  await markDailyAttendance({
    tenantId: apex.id,
    staffId: formTeacherAssignment.staffId,
    classLevelId: sss2.id,
    termId: term.id,
    date: '2024-10-11',
    records: [
      { studentId: firstStudent.studentId, status: 'present' },
      { studentId: sss2Students[1].studentId, status: 'present' },
    ],
  });

  await markDailyAttendance({
    tenantId: apex.id,
    staffId: formTeacherAssignment.staffId,
    classLevelId: sss2.id,
    termId: term.id,
    date: '2024-10-12',
    records: [
      { studentId: firstStudent.studentId, status: 'late' }, // Late counts as present in Nigerian schools
    ],
  });

  ok('Attendance register successfully marked after admin reopen');

  // Verify ledger-not-cache attendance percentage
  const statsStudent1 = await computeAttendanceStats(firstStudent.studentId, term.id);
  // 3 present days out of 60 total days = 5.0%
  if (statsStudent1.presentDays === 3 && statsStudent1.totalSchoolDays === 60 && statsStudent1.percentage === 5) {
    ok(`Attendance ledger computed at read time: 3/60 days = ${statsStudent1.percentage}% (pure ledger, no running cache)`);
  } else {
    fail('Attendance ledger calculation', `Expected 3/60 (5.0%), got ${JSON.stringify(statsStudent1)}`);
  }

  const statsStudent2 = await computeAttendanceStats(sss2Students[1].studentId, term.id);
  // 1 present day out of 60 = 1.7%
  if (statsStudent2.presentDays === 1 && statsStudent2.absentDays === 1 && statsStudent2.percentage === 1.7) {
    ok(`Second student attendance computed: 1/60 days = ${statsStudent2.percentage}% (1 absent)`);
  } else {
    fail('Student 2 attendance', `Expected 1 present, 1 absent, 1.7%, got ${JSON.stringify(statsStudent2)}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Group 6: Multi-Tenant Query Isolation via getTenantDb (§11.1)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n[Group 6: Multi-Tenant Query Isolation via getTenantDb (§11.1)]');
  const beaconDb = getTenantDb(beacon.id);
  const apexDb = getTenantDb(apex.id);

  const beaconEntries = await beaconDb.resultEntry.findMany();
  const apexEntries = await apexDb.resultEntry.findMany();

  if (beaconEntries.length === 0 && apexEntries.length > 0) {
    ok(`Beacon getTenantDb sees 0 result entries while Apex sees ${apexEntries.length} entries`);
  } else {
    fail('ResultEntry isolation', `Beacon saw ${beaconEntries.length} entries`);
  }

  const beaconAttendance = await beaconDb.attendanceRecord.findMany();
  const apexAttendance = await apexDb.attendanceRecord.findMany();

  if (beaconAttendance.length === 0 && apexAttendance.length > 0) {
    ok(`Beacon getTenantDb sees 0 attendance records while Apex sees ${apexAttendance.length} records`);
  } else {
    fail('AttendanceRecord isolation', `Beacon saw ${beaconAttendance.length} records`);
  }

  const beaconReviews = await beaconDb.classResultReview.findMany();
  const apexReviews = await apexDb.classResultReview.findMany();

  if (beaconReviews.length === 0 && apexReviews.length > 0) {
    ok(`Beacon getTenantDb sees 0 class reviews while Apex sees ${apexReviews.length} reviews`);
  } else {
    fail('ClassResultReview isolation', `Beacon saw ${beaconReviews.length} reviews`);
  }

  const beaconAuditLogs = await beaconDb.resultAuditLog.findMany();
  const apexAuditLogs = await apexDb.resultAuditLog.findMany();

  if (beaconAuditLogs.length === 0 && apexAuditLogs.length > 0) {
    ok(`Beacon getTenantDb sees 0 audit logs while Apex sees ${apexAuditLogs.length} audit logs`);
  } else {
    fail('ResultAuditLog isolation', `Beacon saw ${beaconAuditLogs.length} audit logs`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log(`  Module 5 Verification Complete: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run()
  .catch((e) => {
    console.error('Fatal test error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
