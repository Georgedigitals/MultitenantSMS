import prisma from '../src/lib/prisma';

async function testCbtFeatures() {
  console.log('=== VERIFYING CBT FEATURES & DELETE CAPABILITIES ===\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${msg}`);
      throw new Error(msg);
    }
  }

  // Find a tenant with feature_cbt_exams enabled
  const tenant = await prisma.tenant.findFirst({
    where: { slug: 'apex' },
    include: {
      plan: true,
      subjects: true,
      sessions: { include: { terms: true } },
    },
  });

  if (!tenant) {
    throw new Error('Tenant apex not found');
  }

  console.log(`Testing with tenant: ${tenant.name} (${tenant.slug})`);

  const subject = tenant.subjects[0];
  const classLevel = await prisma.classLevel.findFirst();
  const term = tenant.sessions[0]?.terms[0];

  if (!subject || !classLevel || !term) {
    throw new Error('Missing required seed data: subject, classLevel or term');
  }

  // 1. Create a CBT Exam
  console.log('\n--- 1. Testing CBT Exam Creation ---');
  const exam = await prisma.cbtExam.create({
    data: {
      tenantId: tenant.id,
      title: 'Automated Test CBT Exam - Mathematics',
      subjectId: subject.id,
      classLevelId: classLevel.id,
      termId: term.id,
      durationMins: 30,
      totalMarks: 40,
      isPublished: true,
    },
  });

  assert(Boolean(exam.id), 'CBT Exam created successfully in database');
  assert(exam.title === 'Automated Test CBT Exam - Mathematics', 'Exam title matches');

  // 2. Add Questions
  console.log('\n--- 2. Testing CBT Question Creation ---');
  const q1 = await prisma.cbtQuestion.create({
    data: {
      examId: exam.id,
      questionText: 'What is 15 + 25?',
      optionA: '30',
      optionB: '40',
      optionC: '50',
      optionD: '60',
      correctOption: 'B',
      points: 20,
      orderIndex: 1,
    },
  });

  const q2 = await prisma.cbtQuestion.create({
    data: {
      examId: exam.id,
      questionText: 'What is 8 x 5?',
      optionA: '35',
      optionB: '45',
      optionC: '40',
      optionD: '50',
      correctOption: 'C',
      points: 20,
      orderIndex: 2,
    },
  });

  assert(Boolean(q1.id && q2.id), 'Two questions successfully added to exam');

  // 3. Test Question Deletion
  console.log('\n--- 3. Testing Question Deletion ---');
  await prisma.cbtQuestion.delete({ where: { id: q2.id } });
  const remainingQuestions = await prisma.cbtQuestion.findMany({ where: { examId: exam.id } });
  assert(remainingQuestions.length === 1, 'Question 2 was successfully deleted');
  assert(remainingQuestions[0].id === q1.id, 'Question 1 remains intact');

  // 4. Test Student Submission Resolution
  console.log('\n--- 4. Testing Student Attempt Creation & Cascade ---');
  // Find or create a student in this tenant
  let student = await prisma.student.findFirst({
    where: { tenantId: tenant.id },
  });

  if (!student) {
    student = await prisma.student.create({
      data: {
        tenantId: tenant.id,
        name: 'Test Student',
        admissionNumber: 'STU-TEST-001',
      },
    });
  }

  const attempt = await prisma.cbtStudentAttempt.create({
    data: {
      examId: exam.id,
      studentId: student.id,
      score: 20,
      maxScore: 40,
      answers: { [q1.id]: 'B' },
    },
  });

  assert(Boolean(attempt.id), 'Student attempt created successfully');
  assert(attempt.score === 20, 'Attempt score matches expected points');

  // 5. Test Exam Deletion with Cascades
  console.log('\n--- 5. Testing CBT Exam Atomic Deletion with Cascades ---');
  await prisma.$transaction(async (tx) => {
    await tx.cbtStudentAttempt.deleteMany({ where: { examId: exam.id } });
    await tx.cbtQuestion.deleteMany({ where: { examId: exam.id } });
    await tx.cbtExam.delete({ where: { id: exam.id } });
  });

  const deletedExam = await prisma.cbtExam.findUnique({ where: { id: exam.id } });
  const orphanQuestions = await prisma.cbtQuestion.findMany({ where: { examId: exam.id } });
  const orphanAttempts = await prisma.cbtStudentAttempt.findMany({ where: { examId: exam.id } });

  assert(deletedExam === null, 'Exam deleted cleanly');
  assert(orphanQuestions.length === 0, 'No orphaned questions remain');
  assert(orphanAttempts.length === 0, 'No orphaned student attempts remain');

  console.log(`\n=== ALL TESTS PASSED (${passed}/${total}) ===\n`);
}

testCbtFeatures()
  .catch((err) => {
    console.error('Test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
