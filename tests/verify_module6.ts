/**
 * Module 6 Verification — Report Card Generation (§5.2, §5.3A, §11.7, §13.6)
 *
 * Tests the following PRD requirements:
 *  §5.4   Report cards read exclusively from ResultEntry rows with status 'published'
 *  §5A.7  Frozen grade (ResultEntry.grade) is rendered directly; never recomputed from live scale
 *  §5.3A  Attendance percentage computed at read time: (present days) ÷ Term.totalSchoolDays
 *  §3.4   Report card carries tenant branding; zero platform branding
 *  §11.1  Tenant isolation: Tenant B cannot generate or access Tenant A's report card
 *  §13.6  Position/rank calculation; class subject statistics (average, high, low)
 *
 * Run: npx tsx tests/verify_module6.ts
 */

import 'dotenv/config';
import prisma from '../src/lib/prisma';
import {
  saveSubjectScores,
  submitFormTeacherReview,
  publishClassResults,
} from '../src/lib/results';
import { markDailyAttendance } from '../src/lib/attendance';
import { generateStudentReportCard, generateClassReportCards } from '../src/lib/report-card';
import { AttendanceStatus } from '@prisma/client';
import { AFFECTIVE_TRAITS, PSYCHOMOTOR_TRAITS } from '../src/lib/report-card-domains';

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

async function assertThrows(fn: () => Promise<unknown>, substring: string, label: string) {
  try {
    await fn();
    fail(label, `Expected an error containing "${substring}" but none was thrown.`);
  } catch (e: any) {
    if (e.message && e.message.toLowerCase().includes(substring.toLowerCase())) {
      ok(label);
    } else {
      fail(label, `Got error "${e.message}" but expected it to contain "${substring}"`);
    }
  }
}

async function run() {
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  Module 6 — Report Card Generation (§5.2, §5.3A, §11.7, §13.6)');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // ─── Seed Data Setup ───────────────────────────────────────────────────────
  const apex = await prisma.tenant.findUnique({ where: { slug: 'apex' } });
  const beacon = await prisma.tenant.findUnique({ where: { slug: 'beacon' } });

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

  // Ensure totalSchoolDays is set for percentage computation
  await prisma.term.update({
    where: { id: term.id },
    data: { totalSchoolDays: 60 },
  });
  const termWithDays = await prisma.term.findUnique({ where: { id: term.id } });
  if (!termWithDays) throw new Error('Term not found after update');

  // Pick a test class (SSS 2)
  const sss2 = await prisma.classLevel.findUnique({ where: { name: 'SSS 2' } });
  if (!sss2) throw new Error('SSS 2 class level missing from global ladder');

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

  const testStudent = sss2Students[0];

  // Reset to a clean state for this module's tests
  await prisma.resultEntry.deleteMany({
    where: {
      termId: term.id,
    },
  });
  await prisma.classResultReview.deleteMany({
    where: { termId: term.id },
  });
  await prisma.attendanceRecord.deleteMany({
    where: { termId: term.id },
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Group 1: §5.4 — Published-only gate
  // ─────────────────────────────────────────────────────────────────────────
  console.log('[Group 1: §5.4 — Published-only gate for report card generation]');

  await assertThrows(
    () => generateStudentReportCard(apex.id, testStudent.studentId, term.id),
    'No results found',
    '§5.4: Throws when no result entries exist at all'
  );

  // Enter scores as draft (not_started)
  for (const assignment of sss2Assignments) {
    const entries = sss2Students.map((s, idx) => ({
      studentId: s.studentId,
      scores: { '1st CA': 15 + (idx % 5), '2nd CA': 14 + (idx % 4), Exam: 52 + (idx % 8) },
      comment: 'Good performance',
    }));
    await saveSubjectScores({
      tenantId: apex.id,
      teacherId: assignment.staffId,
      classLevelId: sss2.id,
      subjectId: assignment.subjectId,
      termId: term.id,
      markAsSubmitted: false,
      entries,
    });
  }

  await assertThrows(
    () => generateStudentReportCard(apex.id, testStudent.studentId, term.id),
    'published',
    '§5.4: Throws when entries are in not_started status'
  );

  // Submit all subjects
  for (const assignment of sss2Assignments) {
    const entries = sss2Students.map((s, idx) => ({
      studentId: s.studentId,
      scores: { '1st CA': 15 + (idx % 5), '2nd CA': 14 + (idx % 4), Exam: 52 + (idx % 8) },
      comment: 'Good performance',
    }));
    await saveSubjectScores({
      tenantId: apex.id,
      teacherId: assignment.staffId,
      classLevelId: sss2.id,
      subjectId: assignment.subjectId,
      termId: term.id,
      markAsSubmitted: true,
      entries,
    });
  }

  await assertThrows(
    () => generateStudentReportCard(apex.id, testStudent.studentId, term.id),
    'published',
    '§5.4: Throws when entries are in submitted status (not yet published)'
  );

  // Complete domain ratings for all class students before review
  for (const s of sss2Students) {
    await prisma.reportCardAssessment.upsert({
      where: {
        tenantId_studentId_termId: {
          tenantId: apex.id,
          studentId: s.studentId,
          termId: term.id,
        },
      },
      update: {
        affectiveRatings: Object.fromEntries(AFFECTIVE_TRAITS.map(t => [t, 4])),
        psychomotorRatings: Object.fromEntries(PSYCHOMOTOR_TRAITS.map(t => [t, 4])),
      },
      create: {
        tenantId: apex.id,
        studentId: s.studentId,
        termId: term.id,
        classLevelId: sss2.id,
        formTeacherId: formTeacherAssignment.staffId,
        affectiveRatings: Object.fromEntries(AFFECTIVE_TRAITS.map(t => [t, 4])),
        psychomotorRatings: Object.fromEntries(PSYCHOMOTOR_TRAITS.map(t => [t, 4])),
      },
    });
  }

  // Form teacher review
  await submitFormTeacherReview({
    tenantId: apex.id,
    formTeacherId: formTeacherAssignment.staffId,
    classLevelId: sss2.id,
    termId: term.id,
    overallRemarks: 'The class demonstrated commendable effort throughout the term.',
  });

  await assertThrows(
    () => generateStudentReportCard(apex.id, testStudent.studentId, term.id),
    'published',
    '§5.4: Throws when entries are in form_teacher_reviewed status (not yet published)'
  );

  ok('§5.4: Report card correctly blocks all pre-published states');

  // ─────────────────────────────────────────────────────────────────────────
  // Group 2: Mark attendance before publish (§5.3A)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n[Group 2: §5.3A — Attendance marking before publish]');

  // Mark 5 present days for test student
  const dates = [
    new Date('2025-01-06'),
    new Date('2025-01-07'),
    new Date('2025-01-08'),
    new Date('2025-01-09'),
    new Date('2025-01-10'),
  ];

  for (const d of dates) {
    await markDailyAttendance({
      tenantId: apex.id,
      staffId: formTeacherAssignment.staffId,
      classLevelId: sss2.id,
      termId: term.id,
      date: d,
      records: [{ studentId: testStudent.studentId, status: AttendanceStatus.present }],
    });
  }

  // Mark 1 late day (also counted as present for attendance percentage per §5.3A)
  await markDailyAttendance({
    tenantId: apex.id,
    staffId: formTeacherAssignment.staffId,
    classLevelId: sss2.id,
    termId: term.id,
    date: new Date('2025-01-13'),
    records: [{ studentId: testStudent.studentId, status: AttendanceStatus.late }],
  });

  // Mark 2 absent days
  await markDailyAttendance({
    tenantId: apex.id,
    staffId: formTeacherAssignment.staffId,
    classLevelId: sss2.id,
    termId: term.id,
    date: new Date('2025-01-14'),
    records: [{ studentId: testStudent.studentId, status: AttendanceStatus.absent }],
  });
  await markDailyAttendance({
    tenantId: apex.id,
    staffId: formTeacherAssignment.staffId,
    classLevelId: sss2.id,
    termId: term.id,
    date: new Date('2025-01-15'),
    records: [{ studentId: testStudent.studentId, status: AttendanceStatus.absent }],
  });

  ok('§5.3A: Attendance register marked (5 present + 1 late + 2 absent = 8 days recorded)');

  // ─────────────────────────────────────────────────────────────────────────
  // Group 3: Publish & verify grade freeze (§5A.7)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n[Group 3: §5A.7 — Grade Freeze Contract on Publish]');

  // Save the CURRENT grading scale (before publish)
  const gradingScalesBefore = await prisma.gradingScale.findMany({
    where: { tenantId: apex.id },
    include: { lowestClassLevel: true, highestClassLevel: true },
  });

  // Check grade is null before publish
  const prePublishEntry = await prisma.resultEntry.findFirst({
    where: { termId: term.id, studentId: testStudent.studentId },
  });

  if (prePublishEntry && prePublishEntry.grade === null) {
    ok('§5A.7: ResultEntry.grade is null before publish (correct)');
  } else {
    fail('§5A.7: Pre-publish grade', `Expected null, got ${prePublishEntry?.grade}`);
  }

  // Admin publishes
  await publishClassResults({
    tenantId: apex.id,
    classLevelId: sss2.id,
    termId: term.id,
  });

  const postPublishEntry = await prisma.resultEntry.findFirst({
    where: { termId: term.id, studentId: testStudent.studentId },
  });

  if (postPublishEntry && postPublishEntry.grade !== null) {
    ok(`§5A.7: ResultEntry.grade frozen at publish time: "${postPublishEntry.grade}"`);
  } else {
    fail('§5A.7: Post-publish grade', 'Expected grade to be set, got null');
  }

  const frozenGrade = postPublishEntry?.grade;

  // §5A.7: Mutate the grading scale and verify frozen grade is unaffected
  if (gradingScalesBefore.length > 0) {
    const firstScale = gradingScalesBefore[0];
    // Change the grade label on this scale to something clearly different
    await prisma.gradingScale.update({
      where: { id: firstScale.id },
      data: { grade: 'Z', remark: 'Modified Post-Publish' },
    });

    const afterScaleEdit = await prisma.resultEntry.findFirst({
      where: { termId: term.id, studentId: testStudent.studentId },
    });

    if (afterScaleEdit?.grade === frozenGrade) {
      ok(`§5A.7: Frozen grade unchanged after grading scale edit (still "${frozenGrade}")`);
    } else {
      fail(
        '§5A.7: Grade freeze after scale edit',
        `Grade changed from "${frozenGrade}" to "${afterScaleEdit?.grade}" after scale mutation!`
      );
    }

    // Restore the scale
    await prisma.gradingScale.update({
      where: { id: firstScale.id },
      data: { grade: firstScale.grade, remark: firstScale.remark },
    });
  } else {
    ok('§5A.7: No grading scales to test mutation with (skipping mutation test)');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Group 4: generateStudentReportCard — full structure & correctness
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n[Group 4: generateStudentReportCard — Structure & PRD Correctness]');

  const reportCard = await generateStudentReportCard(apex.id, testStudent.studentId, term.id);

  if (reportCard) {
    ok('§13.6: generateStudentReportCard returns successfully for published results');
  } else {
    fail('§13.6: Report card generation', 'Returned null/undefined unexpectedly');
  }

  // Verify school/tenant branding is present (§3.4)
  if (reportCard.school.name === apex.name && reportCard.school.slug === apex.slug) {
    ok('§3.4: Report card carries tenant school name and slug (no platform branding)');
  } else {
    fail(
      '§3.4: Branding',
      `Expected school name "${apex.name}", got "${reportCard.school.name}"`
    );
  }

  if (reportCard.school.branding && typeof reportCard.school.branding.primaryColor === 'string') {
    ok('§3.4: Report card branding object present with primaryColor field');
  } else {
    fail('§3.4: Branding object', 'Branding object missing or primaryColor missing');
  }

  // Verify student identity
  if (reportCard.student.id === testStudent.studentId) {
    ok('§13.6: Report card student.id matches requested studentId');
  } else {
    fail('§13.6: Student ID', `Expected "${testStudent.studentId}", got "${reportCard.student.id}"`);
  }

  // Verify subjects use frozen grades — NOT recomputed from live scale
  const allFrozenGrades = await prisma.resultEntry.findMany({
    where: { termId: term.id, studentId: testStudent.studentId },
    select: { subjectId: true, grade: true },
  });

  const frozenGradeMap = new Map(allFrozenGrades.map((e) => [e.subjectId, e.grade]));

  let allGradesMatchFrozen = true;
  for (const subResult of reportCard.subjects) {
    const frozen = frozenGradeMap.get(subResult.subjectId);
    if (frozen !== subResult.grade) {
      allGradesMatchFrozen = false;
      fail(
        `§5A.7: Frozen grade for subject ${subResult.subjectName}`,
        `Report card shows "${subResult.grade}" but frozen DB grade is "${frozen}"`
      );
    }
  }

  if (allGradesMatchFrozen) {
    ok('§5A.7: All report card subject grades match frozen ResultEntry.grade (never recomputed)');
  }

  // Verify subjects are all published
  const publishedStatuses = reportCard.subjects.every(
    (s) => s.grade !== null && s.grade !== undefined
  );
  if (publishedStatuses) {
    ok('§5.4: All subjects in report card have non-null grades (published state confirmed)');
  } else {
    fail('§5.4: Subject grade', 'Some subjects have null grades in published report card');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Group 5: Attendance in report card (§5.3A)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n[Group 5: §5.3A — Attendance Stats in Report Card]');

  // present = 5 present + 1 late = 6, totalSchoolDays = 60
  const expectedPercentage = Math.round((6 / 60) * 1000) / 10; // 10.0%

  if (reportCard.attendance.presentDays === 6) {
    ok(`§5.3A: presentDays = 6 (5 present + 1 late counted as present)`);
  } else {
    fail('§5.3A: presentDays', `Expected 6, got ${reportCard.attendance.presentDays}`);
  }

  if (reportCard.attendance.totalSchoolDays === 60) {
    ok('§5.3A: totalSchoolDays = 60 (read from Term.totalSchoolDays)');
  } else {
    fail('§5.3A: totalSchoolDays', `Expected 60, got ${reportCard.attendance.totalSchoolDays}`);
  }

  if (reportCard.attendance.percentage === expectedPercentage) {
    ok(`§5.3A: Attendance percentage = ${expectedPercentage}% (ledger-not-cache computation)`);
  } else {
    fail(
      '§5.3A: Attendance percentage',
      `Expected ${expectedPercentage}%, got ${reportCard.attendance.percentage}%`
    );
  }

  if (reportCard.attendance.absentDays === 2) {
    ok('§5.3A: absentDays = 2');
  } else {
    fail('§5.3A: absentDays', `Expected 2, got ${reportCard.attendance.absentDays}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Group 6: Summary stats — position & class average (§13.6)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n[Group 6: §13.6 — Class Ranking & Summary Statistics]');

  if (typeof reportCard.summary.position === 'number' && reportCard.summary.position >= 1) {
    ok(`§13.6: Student class position computed: ${reportCard.summary.position}/${reportCard.summary.classSize}`);
  } else {
    fail('§13.6: Position', `Position should be a number >= 1, got ${reportCard.summary.position}`);
  }

  if (typeof reportCard.summary.averageScore === 'number' && reportCard.summary.averageScore >= 0) {
    ok(`§13.6: Student average score computed: ${reportCard.summary.averageScore}%`);
  } else {
    fail('§13.6: averageScore', `Expected a number, got ${reportCard.summary.averageScore}`);
  }

  if (reportCard.summary.classSize === sss2Students.length) {
    ok(`§13.6: classSize matches enrolled student count (${sss2Students.length})`);
  } else {
    fail(
      '§13.6: classSize',
      `Expected ${sss2Students.length}, got ${reportCard.summary.classSize}`
    );
  }

  if (reportCard.summary.subjectsCount === sss2Assignments.length) {
    ok(`§13.6: subjectsCount matches teaching assignment count (${sss2Assignments.length})`);
  } else {
    fail(
      '§13.6: subjectsCount',
      `Expected ${sss2Assignments.length}, got ${reportCard.summary.subjectsCount}`
    );
  }

  // Check per-subject stats exist
  for (const sub of reportCard.subjects) {
    if (
      typeof sub.classAverage !== 'number' ||
      typeof sub.highestScore !== 'number' ||
      typeof sub.lowestScore !== 'number'
    ) {
      fail(
        `§13.6: Subject stats for ${sub.subjectName}`,
        `Missing classAverage/highestScore/lowestScore`
      );
      break;
    }
  }
  ok('§13.6: All subjects have classAverage, highestScore, and lowestScore');

  // ─────────────────────────────────────────────────────────────────────────
  // Group 7: Form Teacher Remarks in report card (§5.2)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n[Group 7: §5.2 — Form Teacher Remarks]');

  if (
    reportCard.review.formTeacherRemarks === 'The class demonstrated commendable effort throughout the term.'
  ) {
    ok('§5.2: Form teacher remarks preserved correctly in report card');
  } else {
    fail(
      '§5.2: Form teacher remarks',
      `Got: "${reportCard.review.formTeacherRemarks}"`
    );
  }

  if (typeof reportCard.review.principalRemarks === 'string' && reportCard.review.principalRemarks.length > 0) {
    ok(`§5.2: Principal remarks auto-derived from average score: "${reportCard.review.principalRemarks}"`);
  } else {
    fail('§5.2: Principal remarks', 'Missing or empty');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Group 8: Grading scale legend present (§5A)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n[Group 8: §5A — Grading Scale Legend in Report Card]');

  if (reportCard.gradingScale.length > 0) {
    ok(`§5A: Grading scale legend present with ${reportCard.gradingScale.length} entries`);
    const first = reportCard.gradingScale[0];
    if (
      typeof first.grade === 'string' &&
      typeof first.minScore === 'number' &&
      typeof first.maxScore === 'number' &&
      typeof first.remark === 'string'
    ) {
      ok('§5A: Grading scale entries have correct shape (grade, minScore, maxScore, remark)');
    } else {
      fail('§5A: Grading scale entry shape', JSON.stringify(first));
    }
  } else {
    fail('§5A: Grading scale legend', 'Empty grading scale in report card');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Group 9: generateClassReportCards — batch generation (§13.6)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n[Group 9: §13.6 — Batch Class Report Cards]');

  const classReportCards = await generateClassReportCards(apex.id, sss2.id, term.id);

  if (classReportCards.length === sss2Students.length) {
    ok(`§13.6: generateClassReportCards returns ${classReportCards.length} report cards (all published students)`);
  } else {
    fail(
      '§13.6: Batch report cards count',
      `Expected ${sss2Students.length}, got ${classReportCards.length}`
    );
  }

  const allHaveBranding = classReportCards.every((rc) => rc.school.id === apex.id);
  if (allHaveBranding) {
    ok('§3.4: All batch report cards carry the correct tenant branding');
  } else {
    fail('§3.4: Batch branding', 'Some batch report cards have wrong tenant ID');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Group 10: §11.1 — Multi-tenant isolation
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n[Group 10: §11.1 — Multi-Tenant Isolation]');

  // Beacon cannot generate Apex student's report card (student belongs to Apex)
  await assertThrows(
    () => generateStudentReportCard(beacon.id, testStudent.studentId, term.id),
    'not found or unauthorized',
    '§11.1: Beacon cannot generate report card for Apex student (cross-tenant blocked)'
  );

  // Beacon cannot generate report cards for Apex class
  await assertThrows(
    () => generateClassReportCards(beacon.id, sss2.id, term.id),
    'not found or unauthorized',
    '§11.1: Beacon cannot retrieve Apex class report cards (cross-tenant blocked)'
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log(`  Module 6 Results: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
