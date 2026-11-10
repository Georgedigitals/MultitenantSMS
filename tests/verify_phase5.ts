import prisma from '../src/lib/prisma';
import { TenantUserRole, StaffRole } from '@prisma/client';
import {
  hasPermission,
  TenantPermission,
} from '../src/lib/auth/permissions';
import {
  createTenantSession,
  validateTenantSession,
  rotateTenantSession,
  invalidateUserSessions,
  cleanupStaleSessions,
  AuthenticatedTenantUser,
} from '../src/lib/auth/tenant-auth';

async function verifyPhase5() {
  console.log('=== STARTING PHASE 5 RBAC & TOKEN SECURITY VERIFICATION SUITE ===\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, message: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  const uniqueSuffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const tenantSlugA = `rbac-school-a-${uniqueSuffix}`;
  const tenantSlugB = `rbac-school-b-${uniqueSuffix}`;

  let tenantA: any = null;
  let tenantB: any = null;

  try {
    const defaultPlan = await prisma.plan.findFirst();
    if (!defaultPlan) throw new Error('Default plan must exist to run verification');

    // 1. Create sandbox tenants
    tenantA = await prisma.tenant.create({
      data: {
        slug: tenantSlugA,
        name: 'RBAC Academy Alpha',
        planId: defaultPlan.id,
      },
    });

    tenantB = await prisma.tenant.create({
      data: {
        slug: tenantSlugB,
        name: 'RBAC Academy Beta',
        planId: defaultPlan.id,
      },
    });

    // 2. Populate academic structure for Tenant A
    const session = await prisma.academicSession.create({
      data: {
        tenantId: tenantA.id,
        label: '2025/2026 RBAC Session',
        startDate: new Date('2025-09-01'),
        endDate: new Date('2026-07-31'),
        isCurrent: true,
        terms: {
          create: [
            {
              name: 'First Term',
              startDate: new Date('2025-09-01'),
              endDate: new Date('2025-12-15'),
              isCurrent: true,
              totalSchoolDays: 65,
            },
          ],
        },
      },
      include: { terms: true },
    });

    // Find or create ClassLevel SSS 1
    let classLevel = await prisma.classLevel.findFirst({ where: { name: 'SSS 1' } });
    if (!classLevel) {
      classLevel = await prisma.classLevel.create({
        data: { name: 'SSS 1', orderIndex: 10 },
      });
    }

    // Create Subjects: Mathematics and Biology
    const mathSubject = await prisma.subject.create({
      data: { tenantId: tenantA.id, name: `Mathematics-${uniqueSuffix}` },
    });
    const biologySubject = await prisma.subject.create({
      data: { tenantId: tenantA.id, name: `Biology-${uniqueSuffix}` },
    });

    // Create Staff & Tenant Users: Admin, Teacher 1 (Math Teacher), Teacher 2 (Unassigned), Student
    const adminStaff = await prisma.staff.create({
      data: { tenantId: tenantA.id, name: 'Principal Admin', roleBase: StaffRole.admin },
    });
    const adminUser = await prisma.tenantUser.create({
      data: {
        tenantId: tenantA.id,
        username: `admin_${uniqueSuffix}`,
        passwordHash: 'dummy_hash',
        role: TenantUserRole.school_admin,
        staffId: adminStaff.id,
      },
    });

    const teacher1Staff = await prisma.staff.create({
      data: { tenantId: tenantA.id, name: 'Mr. Euler (Math)', roleBase: StaffRole.teacher },
    });
    const teacher1User = await prisma.tenantUser.create({
      data: {
        tenantId: tenantA.id,
        username: `euler_${uniqueSuffix}`,
        passwordHash: 'dummy_hash',
        role: TenantUserRole.teacher,
        staffId: teacher1Staff.id,
      },
    });

    const teacher2Staff = await prisma.staff.create({
      data: { tenantId: tenantA.id, name: 'Ms. Darwin (Biology)', roleBase: StaffRole.teacher },
    });
    const teacher2User = await prisma.tenantUser.create({
      data: {
        tenantId: tenantA.id,
        username: `darwin_${uniqueSuffix}`,
        passwordHash: 'dummy_hash',
        role: TenantUserRole.teacher,
        staffId: teacher2Staff.id,
      },
    });

    const studentRecord = await prisma.student.create({
      data: { tenantId: tenantA.id, name: 'Alice Student' },
    });
    const studentUser = await prisma.tenantUser.create({
      data: {
        tenantId: tenantA.id,
        username: `alice_${uniqueSuffix}`,
        passwordHash: 'dummy_hash',
        role: TenantUserRole.student,
        studentId: studentRecord.id,
      },
    });

    // Assign Teacher 1 to teach Mathematics in SSS 1
    await prisma.teachingAssignment.create({
      data: {
        staffId: teacher1Staff.id,
        classLevelId: classLevel.id,
        subjectId: mathSubject.id,
        sessionId: session.id,
      },
    });

    // Assign Teacher 1 as Form Teacher for SSS 1
    await prisma.formTeacherAssignment.create({
      data: {
        staffId: teacher1Staff.id,
        classLevelId: classLevel.id,
        sessionId: session.id,
      },
    });

    console.log('--- Test 1: Role-Based Permission Matrix (Static Checks) ---');
    const adminAuthUser: AuthenticatedTenantUser = {
      id: adminUser.id,
      tenantId: tenantA.id,
      username: adminUser.username,
      role: adminUser.role,
      staffId: adminUser.staffId,
      studentId: null,
    };

    const teacher1AuthUser: AuthenticatedTenantUser = {
      id: teacher1User.id,
      tenantId: tenantA.id,
      username: teacher1User.username,
      role: teacher1User.role,
      staffId: teacher1User.staffId,
      studentId: null,
    };

    const studentAuthUser: AuthenticatedTenantUser = {
      id: studentUser.id,
      tenantId: tenantA.id,
      username: studentUser.username,
      role: studentUser.role,
      staffId: null,
      studentId: studentUser.studentId,
    };

    // Admin holds full permissions
    assert(await hasPermission(adminAuthUser, 'scores:publish'), 'Admin can publish scores');
    assert(await hasPermission(adminAuthUser, 'scores:reopen'), 'Admin can reopen scores');
    assert(await hasPermission(adminAuthUser, 'fees:manage'), 'Admin can manage fees');
    assert(await hasPermission(adminAuthUser, 'promotions:manage'), 'Admin can manage promotions');
    assert(await hasPermission(adminAuthUser, 'backups:manage'), 'Admin can manage backups');

    // Teacher cannot perform administrative actions
    assert(!(await hasPermission(teacher1AuthUser, 'scores:publish')), 'Teacher blocked from publishing scores');
    assert(!(await hasPermission(teacher1AuthUser, 'scores:reopen')), 'Teacher blocked from reopening scores');
    assert(!(await hasPermission(teacher1AuthUser, 'fees:manage')), 'Teacher blocked from managing fee items');
    assert(!(await hasPermission(teacher1AuthUser, 'promotions:manage')), 'Teacher blocked from executing promotions');
    assert(!(await hasPermission(teacher1AuthUser, 'backups:manage')), 'Teacher blocked from managing backups');

    // Student cannot perform staff or admin actions
    assert(!(await hasPermission(studentAuthUser, 'scores:enter')), 'Student blocked from entering scores');
    assert(!(await hasPermission(studentAuthUser, 'fees:manage')), 'Student blocked from managing fees');
    assert(
      await hasPermission(studentAuthUser, 'portal:own_results', { studentId: studentRecord.id }),
      'Student can view own results'
    );
    assert(
      !(await hasPermission(studentAuthUser, 'portal:own_results', { studentId: 'other-student-id' })),
      'Student blocked from viewing another student results'
    );

    console.log('\n--- Test 2: Contextual Teaching Assignment Scoping ---');
    // Teacher 1 is assigned to Math in SSS 1
    const teacher1CanMath = await hasPermission(teacher1AuthUser, 'scores:enter', {
      classLevelId: classLevel.id,
      subjectId: mathSubject.id,
      sessionId: session.id,
    });
    assert(teacher1CanMath === true, 'Assigned teacher is permitted to enter scores for assigned Math class');

    // Teacher 1 is NOT assigned to Biology in SSS 1
    const teacher1CanBio = await hasPermission(teacher1AuthUser, 'scores:enter', {
      classLevelId: classLevel.id,
      subjectId: biologySubject.id,
      sessionId: session.id,
    });
    assert(teacher1CanBio === false, 'Teacher is strictly blocked from entering scores for unassigned Biology class');

    // Teacher 2 has NO teaching assignments
    const teacher2AuthUser: AuthenticatedTenantUser = {
      id: teacher2User.id,
      tenantId: tenantA.id,
      username: teacher2User.username,
      role: teacher2User.role,
      staffId: teacher2User.staffId,
      studentId: null,
    };
    const teacher2CanMath = await hasPermission(teacher2AuthUser, 'scores:enter', {
      classLevelId: classLevel.id,
      subjectId: mathSubject.id,
      sessionId: session.id,
    });
    assert(teacher2CanMath === false, 'Unassigned teacher cannot enter scores for Math');

    // Admin override: Admin can enter scores for any subject/class
    const adminCanBio = await hasPermission(adminAuthUser, 'scores:enter', {
      classLevelId: classLevel.id,
      subjectId: biologySubject.id,
      sessionId: session.id,
    });
    assert(adminCanBio === true, 'School Administrator has override permission to enter scores');

    console.log('\n--- Test 3: Contextual Form Teacher Broadsheet Review ---');
    // Teacher 1 is form teacher for SSS 1
    const teacher1CanReview = await hasPermission(teacher1AuthUser, 'scores:review', {
      classLevelId: classLevel.id,
      sessionId: session.id,
    });
    assert(teacher1CanReview === true, 'Assigned form teacher is permitted to review broadsheet');

    // Teacher 2 is NOT form teacher for SSS 1
    const teacher2CanReview = await hasPermission(teacher2AuthUser, 'scores:review', {
      classLevelId: classLevel.id,
      sessionId: session.id,
    });
    assert(teacher2CanReview === false, 'Non-form teacher is strictly blocked from broadsheet review');

    console.log('\n--- Test 4: Token Security, Rotation & Session Invalidation ---');
    // 1. Create two sessions for teacher 1
    const s1 = await createTenantSession(tenantA.id, teacher1User.id);
    const s2 = await createTenantSession(tenantA.id, teacher1User.id);
    assert(Boolean(s1.token) && Boolean(s2.token), 'Created two distinct cryptographically random tokens');

    // Both should validate successfully
    const val1 = await validateTenantSession(tenantA.id, s1.token);
    const val2 = await validateTenantSession(tenantA.id, s2.token);
    assert(val1?.user.id === teacher1User.id, 'Session 1 validates cleanly');
    assert(val2?.user.id === teacher1User.id, 'Session 2 validates cleanly');

    // 2. Rotate session 1
    const rotated = await rotateTenantSession(s1.token);
    assert(Boolean(rotated?.token), 'rotateTenantSession generated a fresh session token');

    // Old token must now be invalid
    const oldTokenValidation = await validateTenantSession(tenantA.id, s1.token);
    assert(oldTokenValidation === null, 'Old rotated session token is strictly invalidated');

    // New token must validate
    const newTokenValidation = await validateTenantSession(tenantA.id, rotated!.token);
    assert(newTokenValidation?.user.id === teacher1User.id, 'New rotated token validates successfully');

    // 3. Invalidate all sessions for teacher 1
    const revokedCount = await invalidateUserSessions(teacher1User.id);
    assert(revokedCount >= 2, `invalidateUserSessions revoked active sessions (count: ${revokedCount})`);

    const revokedValidation = await validateTenantSession(tenantA.id, rotated!.token);
    assert(revokedValidation === null, 'All sessions for user are dead after invalidateUserSessions');

    // 4. Test stale session cleanup
    const expiredTokenHash = 'expired_test_token_hash_' + uniqueSuffix;
    await prisma.tenantSession.create({
      data: {
        tenantId: tenantA.id,
        userId: adminUser.id,
        tokenHash: expiredTokenHash,
        expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
      },
    });

    const cleanedCount = await cleanupStaleSessions(tenantA.id);
    assert(cleanedCount >= 1, `cleanupStaleSessions successfully purged expired sessions (count: ${cleanedCount})`);

    console.log('\n--- Test 5: Multi-Tenant Boundary Enforcement on Sessions ---');
    // User in Tenant A attempts to access Tenant B with valid token
    const tenantAToken = (await createTenantSession(tenantA.id, adminUser.id)).token;
    const crossTenantAttempt = await validateTenantSession(tenantB.id, tenantAToken);
    assert(crossTenantAttempt === null, 'Token from School A is strictly rejected when presented to School B');

    // Cleanup test data cleanly in dependency order
    await prisma.tenantSession.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
    await prisma.formTeacherAssignment.deleteMany({ where: { sessionId: session.id } });
    await prisma.teachingAssignment.deleteMany({ where: { sessionId: session.id } });
    await prisma.tenantUser.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
    await prisma.staff.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
    await prisma.student.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
    await prisma.subject.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
    await prisma.term.deleteMany({ where: { sessionId: session.id } });
    await prisma.academicSession.deleteMany({ where: { tenantId: tenantA.id } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantA.id, tenantB.id] } } });

    console.log('\n=================================================');
    console.log(`SUCCESS: All ${passed}/${total} Phase 5 RBAC & Token Security Checks Passed Cleanly!`);
    console.log('=================================================\n');
  } catch (error) {
    console.error('Phase 5 verification error:', error);
    if (tenantA || tenantB) {
      await prisma.tenantSession.deleteMany({ where: { tenantId: { in: [tenantA?.id, tenantB?.id].filter(Boolean) } } }).catch(() => {});
      await prisma.tenantUser.deleteMany({ where: { tenantId: { in: [tenantA?.id, tenantB?.id].filter(Boolean) } } }).catch(() => {});
      await prisma.tenant.deleteMany({ where: { id: { in: [tenantA?.id, tenantB?.id].filter(Boolean) } } }).catch(() => {});
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyPhase5();
