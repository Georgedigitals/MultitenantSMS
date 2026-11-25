import { TenantStatus, TenantUserRole, StaffRole, EnrollmentStatus } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/auth/passwords';

async function main() {
  console.log('🌱 Starting database seed for Modules 1, 2 & 3...');

  // ─── 1. Global ClassLevels ───────────────────────────────────────────────
  console.log('\n[1/11] Seeding global ClassLevels...');
  const classLevelsData = [
    { name: 'Nursery 1', orderIndex: 1 },
    { name: 'Nursery 2', orderIndex: 2 },
    { name: 'Nursery 3', orderIndex: 3 },
    { name: 'Primary 1', orderIndex: 4 },
    { name: 'Primary 2', orderIndex: 5 },
    { name: 'Primary 3', orderIndex: 6 },
    { name: 'Primary 4', orderIndex: 7 },
    { name: 'Primary 5', orderIndex: 8 },
    { name: 'Primary 6', orderIndex: 9 },
    { name: 'JSS 1', orderIndex: 10 },
    { name: 'JSS 2', orderIndex: 11 },
    { name: 'JSS 3', orderIndex: 12 },
    { name: 'SSS 1', orderIndex: 13 },
    { name: 'SSS 2', orderIndex: 14 },
    { name: 'SSS 3', orderIndex: 15 },
  ];

  const classLevels: Record<string, string> = {};
  for (const level of classLevelsData) {
    const existing = await prisma.classLevel.findFirst({
      where: { tenantId: null, name: level.name },
    });
    const record = existing
      ? await prisma.classLevel.update({
          where: { id: existing.id },
          data: { orderIndex: level.orderIndex },
        })
      : await prisma.classLevel.create({
          data: { ...level, tenantId: null },
        });
    classLevels[record.name] = record.id;
  }
  console.log(`  ✓ ${classLevelsData.length} global class levels`);

  // ─── 2. Features ──────────────────────────────────────────────────────────
  console.log('[2/11] Seeding Features...');
  const featuresData = [
    { key: 'custom_domain', name: 'Custom Domain', description: 'CNAME domain mapping for school branding' },
    { key: 'result_pins', name: 'Result PIN System', description: 'Paid result-checker PINs for parent/student access' },
    { key: 'school_fees', name: 'School Fee Tracking', description: 'Fee item ledger and payment reconciliation' },
    { key: 'gallery', name: 'Public Gallery', description: 'Media gallery on the public school portal' },
    { key: 'notifications', name: 'In-app Notifications', description: 'Real-time in-app notification center' },
    { key: 'grading_customization', name: 'Grading Customization', description: 'Customize assessment components and grading scale bands' },
    { key: 'feature_sms_alerts', name: 'SMS Alerts Engine', description: 'Automated SMS broadcasts for fee receipts, results, and attendance' },
    { key: 'feature_whatsapp_alerts', name: 'WhatsApp Business Alerts', description: 'Direct WhatsApp notifications for PDF report cards and invoices' },
    { key: 'feature_cbt_exams', name: 'CBT Online Exams Engine', description: 'Timed computer-based testing, auto-grading, and question banks' },
    { key: 'feature_bus_tracking', name: 'School Bus & Fleet Tracking', description: 'Transport routes, driver assignments, and student pickup rosters' },
  ];
  for (const feat of featuresData) {
    await prisma.feature.upsert({
      where: { key: feat.key },
      update: { name: feat.name, description: feat.description },
      create: feat,
    });
  }
  console.log(`  ✓ ${featuresData.length} features`);

  // ─── 3. Plans ─────────────────────────────────────────────────────────────
  console.log('[3/11] Seeding Plans...');
  const plansData = [
    { id: 'plan_starter', name: 'Starter', studentCeiling: 200, price: 50000.0, pinRequired: true, platformFeePercent: 10.0, features: ['result_pins', 'notifications', 'feature_sms_alerts'] },
    { id: 'plan_growth', name: 'Growth', studentCeiling: 600, price: 120000.0, pinRequired: true, platformFeePercent: 8.0, features: ['result_pins', 'school_fees', 'gallery', 'notifications', 'feature_sms_alerts', 'feature_whatsapp_alerts', 'feature_cbt_exams'] },
    { id: 'plan_enterprise', name: 'Enterprise', studentCeiling: 2500, price: 250000.0, pinRequired: true, platformFeePercent: 5.0, features: ['custom_domain', 'result_pins', 'school_fees', 'gallery', 'notifications', 'grading_customization', 'feature_sms_alerts', 'feature_whatsapp_alerts', 'feature_cbt_exams', 'feature_bus_tracking'] },
  ];
  for (const p of plansData) {
    const plan = await prisma.plan.upsert({
      where: { id: p.id },
      update: { name: p.name, studentCeiling: p.studentCeiling, price: p.price, pinRequired: p.pinRequired, platformFeePercent: p.platformFeePercent },
      create: { id: p.id, name: p.name, studentCeiling: p.studentCeiling, price: p.price, pinRequired: p.pinRequired, platformFeePercent: p.platformFeePercent },
    });
    for (const featKey of p.features) {
      await prisma.planFeature.upsert({
        where: { planId_featureKey: { planId: plan.id, featureKey: featKey } },
        update: { enabledByDefault: true },
        create: { planId: plan.id, featureKey: featKey, enabledByDefault: true },
      });
    }
  }
  console.log(`  ✓ ${plansData.length} plans`);

  // ─── 4. SuperAdmin ────────────────────────────────────────────────────────
  console.log('[4/11] Seeding SuperAdmin...');
  const envAdminEmail = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const envAdminPassword = process.env.SUPER_ADMIN_PASSWORD;

  if (envAdminEmail && envAdminPassword) {
    const customPasswordHash = await hashPassword(envAdminPassword);
    await prisma.superAdmin.upsert({
      where: { email: envAdminEmail },
      update: { passwordHash: customPasswordHash },
      create: { email: envAdminEmail, name: 'Platform Super Admin', passwordHash: customPasswordHash },
    });
    console.log(`  ✓ Configured Super Admin from .env: ${envAdminEmail}`);
  }

  // Also maintain the default demo admin for local testing
  const superAdminPasswordHash = await hashPassword('SuperAdmin123!');
  await prisma.superAdmin.upsert({
    where: { email: 'admin@platform.com' },
    update: { passwordHash: superAdminPasswordHash },
    create: { email: 'admin@platform.com', name: 'Platform Super Admin', passwordHash: superAdminPasswordHash },
  });
  console.log('  ✓ Default Super Admin: admin@platform.com / SuperAdmin123!');

  // ─── 5. Apex Academy tenant ───────────────────────────────────────────────
  console.log('[5/11] Seeding Tenant: Apex Academy...');
  const apex = await prisma.tenant.upsert({
    where: { slug: 'apex' },
    update: {
      name: 'Apex Academy',
      planId: 'plan_growth',
      status: TenantStatus.active,
      lowestClassLevelId: classLevels['Nursery 1'],
      highestClassLevelId: classLevels['SSS 3'],
      branding: { primaryColor: '#1E3A8A', accentColor: '#2563EB', logoUrl: null, fontHeading: 'Inter', fontBody: 'Inter' },
    },
    create: {
      slug: 'apex',
      name: 'Apex Academy',
      planId: 'plan_growth',
      status: TenantStatus.active,
      lowestClassLevelId: classLevels['Nursery 1'],
      highestClassLevelId: classLevels['SSS 3'],
      branding: { primaryColor: '#1E3A8A', accentColor: '#2563EB', logoUrl: null, fontHeading: 'Inter', fontBody: 'Inter' },
    },
  });
  console.log(`  ✓ Apex Academy (id: ${apex.id})`);

  // ─── 6. Apex Academic Session & Terms ────────────────────────────────────
  console.log('[6/11] Seeding Apex 2024/2025 session...');
  const session2024 = await prisma.academicSession.upsert({
    where: { tenantId_label: { tenantId: apex.id, label: '2024/2025' } },
    update: { isCurrent: true, startDate: new Date('2024-09-02'), endDate: new Date('2025-07-18') },
    create: { tenantId: apex.id, label: '2024/2025', isCurrent: true, startDate: new Date('2024-09-02'), endDate: new Date('2025-07-18') },
  });

  const termsData = [
    { name: '1st Term', startDate: new Date('2024-09-02'), endDate: new Date('2024-12-13'), isCurrent: true },
    { name: '2nd Term', startDate: new Date('2025-01-06'), endDate: new Date('2025-04-11'), isCurrent: false },
    { name: '3rd Term', startDate: new Date('2025-04-28'), endDate: new Date('2025-07-18'), isCurrent: false },
  ];
  const terms: Record<string, string> = {};
  for (const term of termsData) {
    const t = await prisma.term.upsert({
      where: { sessionId_name: { sessionId: session2024.id, name: term.name } },
      update: { startDate: term.startDate, endDate: term.endDate, isCurrent: term.isCurrent },
      create: { sessionId: session2024.id, ...term },
    });
    terms[term.name] = t.id;
  }
  console.log('  ✓ 2024/2025 session + 3 terms');

  // ─── 7. Apex Staff (6 staff members) ─────────────────────────────────────
  console.log('[7/11] Seeding Apex staff...');

  let staffSeq = 1;
  async function upsertStaff(tenantId: string, name: string, roleBase: StaffRole, contactEmail: string) {
    const existing = await prisma.staff.findFirst({ where: { tenantId, name } });
    if (existing) return existing;
    const staffCode = `STF-${String(staffSeq).padStart(3, '0')}`;
    const attendancePin = String(1000 + staffSeq);
    staffSeq++;
    return prisma.staff.create({
      data: { tenantId, name, roleBase, contactInfo: { email: contactEmail }, staffCode, attendancePin },
    });
  }

  const staffFolashade   = await upsertStaff(apex.id, 'Mrs. Folashade Adeleke',   StaffRole.teacher, 'teacher@apex.edu');
  const staffChukwuemeka = await upsertStaff(apex.id, 'Mr. Chukwuemeka Obi',      StaffRole.teacher, 'cobi@apex.edu');
  const staffNgozi       = await upsertStaff(apex.id, 'Mrs. Ngozi Eze',            StaffRole.teacher, 'ngozi@apex.edu');
  const staffKehinde     = await upsertStaff(apex.id, 'Mr. Kehinde Balogun',       StaffRole.teacher, 'kehinde@apex.edu');
  const staffPatricia    = await upsertStaff(apex.id, 'Miss Patricia Okafor',      StaffRole.teacher, 'patricia@apex.edu');
  const staffAdminUser   = await upsertStaff(apex.id, 'Mr. Babatunde Lawal',       StaffRole.admin,   'admin@apex.edu');
  console.log('  ✓ 6 staff members');

  // ─── 8. Apex Subjects ─────────────────────────────────────────────────────
  console.log('[8/11] Seeding Apex subjects...');

  async function upsertSubject(tenantId: string, name: string) {
    return prisma.subject.upsert({
      where: { tenantId_name: { tenantId, name } },
      update: {},
      create: { tenantId, name },
    });
  }

  const subjectEnglish   = await upsertSubject(apex.id, 'English Language');
  const subjectMath      = await upsertSubject(apex.id, 'Mathematics');
  const subjectBiology   = await upsertSubject(apex.id, 'Biology');
  const subjectChemistry = await upsertSubject(apex.id, 'Chemistry');
  const subjectPhysics   = await upsertSubject(apex.id, 'Physics');
  const subjectLiterature= await upsertSubject(apex.id, 'Literature in English');
  const subjectCivic     = await upsertSubject(apex.id, 'Civic Education');
  const subjectFurther   = await upsertSubject(apex.id, 'Further Mathematics');
  console.log('  ✓ 8 subjects');

  // ─── 9. Apex Students (10 students) + Enrollments ─────────────────────────
  console.log('[9/11] Seeding Apex students and enrollments...');

  let stuSeq = 1;
  async function upsertStudent(tenantId: string, name: string, guardianContact: any) {
    const existing = await prisma.student.findFirst({ where: { tenantId, name } });
    if (existing) return existing;
    const admissionNumber = `APEX/2026/${String(stuSeq).padStart(4, '0')}`;
    guardianContact.admissionNo = admissionNumber;
    stuSeq++;
    return prisma.student.create({ data: { tenantId, name, admissionNumber, guardianContactInfo: guardianContact } });
  }

  const studentsData = [
    { name: 'Samuel Adeyemi',    classLevel: 'SSS 2', guardian: { name: 'Mr. & Mrs. Adeyemi', phone: '+2348055667788', email: 'parent@apex.edu' } },
    { name: 'Chidinma Okafor',   classLevel: 'SSS 2', guardian: { name: 'Mrs. Okafor',        phone: '+2348022113344', email: 'cokafor@gmail.com' } },
    { name: 'Temilade Afolabi',  classLevel: 'SSS 1', guardian: { name: 'Mr. Afolabi',         phone: '+2348033445566', email: 'tafolabi@gmail.com' } },
    { name: 'Ibrahim Musa',      classLevel: 'SSS 1', guardian: { name: 'Alhaji Musa',         phone: '+2348044556677', email: 'amusa@gmail.com' } },
    { name: 'Adaeze Nwosu',      classLevel: 'JSS 3', guardian: { name: 'Mrs. Nwosu',          phone: '+2348055667788', email: 'anwosu@gmail.com' } },
    { name: 'Oluwafemi Badmus',  classLevel: 'JSS 3', guardian: { name: 'Mr. Badmus',          phone: '+2348011223344', email: 'obadmus@gmail.com' } },
    { name: 'Blessing Onyekachi', classLevel: 'JSS 2', guardian: { name: 'Mrs. Onyekachi',    phone: '+2348066778899', email: 'bonyekachi@gmail.com' } },
    { name: 'Emeka Chukwu',      classLevel: 'JSS 1', guardian: { name: 'Mr. Chukwu',         phone: '+2348077889900', email: 'echukwu@gmail.com' } },
    { name: 'Fatima Abubakar',   classLevel: 'Primary 6', guardian: { name: 'Alhaja Abubakar', phone: '+2348088990011', email: 'fabubakar@gmail.com' } },
    { name: 'Sola Olatunde',     classLevel: 'Primary 5', guardian: { name: 'Mr. Olatunde',   phone: '+2348099001122', email: 'solatunde@gmail.com' } },
  ];

  const studentMap: Record<string, { id: string; classLevelId: string }> = {};
  for (const s of studentsData) {
    const student = await upsertStudent(apex.id, s.name, s.guardian);
    const classLevelId = classLevels[s.classLevel];

    // Enrollment for 2024/2025 session — §4.1: new row per session, never mutated
    const existingEnrollment = await prisma.enrollment.findUnique({
      where: { studentId_sessionId: { studentId: student.id, sessionId: session2024.id } },
    });
    if (!existingEnrollment) {
      await prisma.enrollment.create({
        data: {
          studentId: student.id,
          classLevelId,
          sessionId: session2024.id,
          status: EnrollmentStatus.active,
        },
      });
    }
    studentMap[s.name] = { id: student.id, classLevelId };
  }
  console.log('  ✓ 10 students enrolled in 2024/2025 session');

  // ─── 10. Form Teacher & Teaching Assignments ──────────────────────────────
  console.log('[10/11] Seeding assignments...');

  // §4.1 — FormTeacherAssignment: one active per class per session
  // §4.1 — resolved against current session only (sessionId = session2024.id)
  async function upsertFormTeacher(staffId: string, classLevelId: string, sessionId: string) {
    const existing = await prisma.formTeacherAssignment.findUnique({
      where: { classLevelId_sessionId: { classLevelId, sessionId } },
    });
    if (existing) return existing;
    return prisma.formTeacherAssignment.create({ data: { staffId, classLevelId, sessionId } });
  }

  // §4.1 — a staff member can simultaneously hold multiple TeachingAssignment rows
  // AND at most one active FormTeacherAssignment per session
  async function upsertTeachingAssignment(staffId: string, classLevelId: string, subjectId: string, sessionId: string) {
    const existing = await prisma.teachingAssignment.findFirst({
      where: { staffId, classLevelId, subjectId, sessionId },
    });
    if (existing) return existing;
    return prisma.teachingAssignment.create({ data: { staffId, classLevelId, subjectId, sessionId } });
  }

  const sss2Id = classLevels['SSS 2'];
  const sss1Id = classLevels['SSS 1'];
  const jss3Id = classLevels['JSS 3'];
  const jss2Id = classLevels['JSS 2'];
  const jss1Id = classLevels['JSS 1'];
  const sessionId = session2024.id;

  // Form Teacher Assignments (current session only — §4.1)
  await upsertFormTeacher(staffFolashade.id,   sss2Id, sessionId); // SSS 2 form teacher
  await upsertFormTeacher(staffChukwuemeka.id, sss1Id, sessionId); // SSS 1 form teacher
  await upsertFormTeacher(staffNgozi.id,       jss3Id, sessionId); // JSS 3 form teacher
  await upsertFormTeacher(staffKehinde.id,     jss2Id, sessionId); // JSS 2 form teacher
  await upsertFormTeacher(staffPatricia.id,    jss1Id, sessionId); // JSS 1 form teacher

  // Teaching Assignments — multiple per staff, independent of form-teacher role (§4.1)
  // Mrs. Folashade Adeleke: English (SSS 2 + SSS 1) — also form teacher of SSS 2
  await upsertTeachingAssignment(staffFolashade.id,   sss2Id, subjectEnglish.id,  sessionId);
  await upsertTeachingAssignment(staffFolashade.id,   sss2Id, subjectLiterature.id, sessionId);
  await upsertTeachingAssignment(staffFolashade.id,   sss1Id, subjectEnglish.id,  sessionId);

  // Mr. Chukwuemeka: Math + Further Maths (SSS 2 + SSS 1) — also form teacher of SSS 1
  await upsertTeachingAssignment(staffChukwuemeka.id, sss2Id, subjectMath.id,     sessionId);
  await upsertTeachingAssignment(staffChukwuemeka.id, sss2Id, subjectFurther.id,  sessionId);
  await upsertTeachingAssignment(staffChukwuemeka.id, sss1Id, subjectMath.id,     sessionId);

  // Mrs. Ngozi Eze: Biology + Civic (SSS 1 + JSS 3) — also form teacher of JSS 3
  await upsertTeachingAssignment(staffNgozi.id,       sss1Id, subjectBiology.id,  sessionId);
  await upsertTeachingAssignment(staffNgozi.id,       jss3Id, subjectBiology.id,  sessionId);
  await upsertTeachingAssignment(staffNgozi.id,       jss3Id, subjectCivic.id,    sessionId);

  // Mr. Kehinde: Chemistry + Physics (SSS 2) — also form teacher of JSS 2
  await upsertTeachingAssignment(staffKehinde.id,     sss2Id, subjectChemistry.id, sessionId);
  await upsertTeachingAssignment(staffKehinde.id,     sss2Id, subjectPhysics.id,  sessionId);
  await upsertTeachingAssignment(staffKehinde.id,     jss2Id, subjectMath.id,     sessionId);
  await upsertTeachingAssignment(staffKehinde.id,     jss2Id, subjectCivic.id,    sessionId);

  // Miss Patricia: English + Math (JSS 1 + JSS 2) — also form teacher of JSS 1
  await upsertTeachingAssignment(staffPatricia.id,    jss1Id, subjectEnglish.id,  sessionId);
  await upsertTeachingAssignment(staffPatricia.id,    jss1Id, subjectMath.id,     sessionId);
  await upsertTeachingAssignment(staffPatricia.id,    jss2Id, subjectEnglish.id,  sessionId);

  console.log('  ✓ 5 form teacher assignments + 16 teaching assignments');

  // ─── 11. Tenant Users ──────────────────────────────────────────────────────
  console.log('[11/11] Seeding Apex tenant users...');

  const samuelStudent = await prisma.student.findFirst({ where: { tenantId: apex.id, name: 'Samuel Adeyemi' } });

  const apexUsers = [
    { username: 'admin@apex.edu',    password: 'ApexAdmin123!',   role: TenantUserRole.school_admin, staffId: staffAdminUser.id, studentId: null },
    { username: 'teacher@apex.edu',  password: 'ApexTeacher123!', role: TenantUserRole.teacher,      staffId: staffFolashade.id, studentId: null },
    { username: 'parent@apex.edu',   password: 'ApexParent123!',  role: TenantUserRole.parent,       staffId: null, studentId: null },
    { username: 'student1',          password: 'ApexStudent123!', role: TenantUserRole.student,      staffId: null, studentId: samuelStudent?.id ?? null },
  ];

  for (const u of apexUsers) {
    const passwordHash = await hashPassword(u.password);
    await prisma.tenantUser.upsert({
      where: { tenantId_username: { tenantId: apex.id, username: u.username.toLowerCase() } },
      update: { passwordHash, role: u.role, staffId: u.staffId, studentId: u.studentId, isActive: true },
      create: { tenantId: apex.id, username: u.username.toLowerCase(), passwordHash, role: u.role, staffId: u.staffId, studentId: u.studentId, isActive: true },
    });
  }
  console.log('  ✓ 4 tenant users (admin, teacher, parent, student)');

  // ─── Beacon College ───────────────────────────────────────────────────────
  const beacon = await prisma.tenant.upsert({
    where: { slug: 'beacon' },
    update: { name: 'Beacon College', planId: 'plan_starter', status: TenantStatus.active, lowestClassLevelId: classLevels['JSS 1'], highestClassLevelId: classLevels['SSS 3'], branding: { primaryColor: '#047857', accentColor: '#10B981', logoUrl: null, fontHeading: 'Outfit', fontBody: 'Outfit' } },
    create: { slug: 'beacon', name: 'Beacon College', planId: 'plan_starter', status: TenantStatus.active, lowestClassLevelId: classLevels['JSS 1'], highestClassLevelId: classLevels['SSS 3'], branding: { primaryColor: '#047857', accentColor: '#10B981', logoUrl: null, fontHeading: 'Outfit', fontBody: 'Outfit' } },
  });

  const beaconStaff = await upsertStaff(beacon.id, 'Mr. David Beacon', StaffRole.teacher, 'teacher@beacon.edu');
  const beaconAdminStaff = await upsertStaff(beacon.id, 'Dr. Victoria Beacon', StaffRole.admin, 'admin@beacon.edu');
  const beaconStudent = await upsertStudent(beacon.id, 'Victor BeaconStudent', { name: 'Mr. & Mrs. BeaconParent', phone: '+2348000000001', email: 'parent@beacon.edu' });

  const beaconUsers = [
    { username: 'admin@beacon.edu',   password: 'BeaconAdmin123!',   role: TenantUserRole.school_admin, staffId: beaconAdminStaff.id, studentId: null },
    { username: 'teacher@beacon.edu', password: 'BeaconTeacher123!', role: TenantUserRole.teacher,      staffId: beaconStaff.id,      studentId: null },
    { username: 'parent@beacon.edu',  password: 'BeaconParent123!',  role: TenantUserRole.parent,       staffId: null,                studentId: null },
    { username: 'student1',         password: 'BeaconStudent123!', role: TenantUserRole.student,      staffId: null,                studentId: beaconStudent.id },
  ];
  for (const u of beaconUsers) {
    const passwordHash = await hashPassword(u.password);
    await prisma.tenantUser.upsert({
      where: { tenantId_username: { tenantId: beacon.id, username: u.username.toLowerCase() } },
      update: { passwordHash, role: u.role, staffId: u.staffId, studentId: u.studentId, isActive: true },
      create: { tenantId: beacon.id, username: u.username.toLowerCase(), passwordHash, role: u.role, staffId: u.staffId, studentId: u.studentId, isActive: true },
    });
  }

  // ─── Crestview International School ──────────────────────────────────────
  console.log('\n[Tenant 3] Seeding Crestview International School...');
  const crestview = await prisma.tenant.upsert({
    where: { slug: 'crestview' },
    update: {
      name: 'Crestview International School',
      planId: 'plan_enterprise',
      status: TenantStatus.active,
      lowestClassLevelId: classLevels['Nursery 1'],
      highestClassLevelId: classLevels['SSS 3'],
      branding: { primaryColor: '#7C3AED', accentColor: '#C084FC', logoUrl: null, fontHeading: 'Outfit', fontBody: 'Inter' },
    },
    create: {
      slug: 'crestview',
      name: 'Crestview International School',
      planId: 'plan_enterprise',
      status: TenantStatus.active,
      lowestClassLevelId: classLevels['Nursery 1'],
      highestClassLevelId: classLevels['SSS 3'],
      branding: { primaryColor: '#7C3AED', accentColor: '#C084FC', logoUrl: null, fontHeading: 'Outfit', fontBody: 'Inter' },
    },
  });

  const crestviewStaff = await upsertStaff(crestview.id, 'Prof. Elizabeth Crestview', StaffRole.teacher, 'teacher@crestview.edu');
  const crestviewAdminStaff = await upsertStaff(crestview.id, 'Dr. Arthur Crestview', StaffRole.admin, 'admin@crestview.edu');
  const crestviewStudent = await upsertStudent(crestview.id, 'Claire CrestviewStudent', { name: 'Lady CrestviewParent', phone: '+2348000000002', email: 'parent@crestview.edu' });

  const crestviewUsers = [
    { username: 'admin@crestview.edu',   password: 'CrestviewAdmin123!',   role: TenantUserRole.school_admin, staffId: crestviewAdminStaff.id, studentId: null },
    { username: 'teacher@crestview.edu', password: 'CrestviewTeacher123!', role: TenantUserRole.teacher,      staffId: crestviewStaff.id,      studentId: null },
    { username: 'parent@crestview.edu',  password: 'CrestviewParent123!',  role: TenantUserRole.parent,       staffId: null,                   studentId: null },
    { username: 'student1',            password: 'CrestviewStudent123!', role: TenantUserRole.student,      staffId: null,                   studentId: crestviewStudent.id },
  ];
  for (const u of crestviewUsers) {
    const passwordHash = await hashPassword(u.password);
    await prisma.tenantUser.upsert({
      where: { tenantId_username: { tenantId: crestview.id, username: u.username.toLowerCase() } },
      update: { passwordHash, role: u.role, staffId: u.staffId, studentId: u.studentId, isActive: true },
      create: { tenantId: crestview.id, username: u.username.toLowerCase(), passwordHash, role: u.role, staffId: u.staffId, studentId: u.studentId, isActive: true },
    });
  }

  await prisma.domainAlias.upsert({
    where: { domain: 'crestview.localhost:3000' },
    update: { tenantId: crestview.id, verifiedAt: new Date(), verificationToken: 'token_crestview_local' },
    create: { tenantId: crestview.id, domain: 'crestview.localhost:3000', verifiedAt: new Date(), verificationToken: 'token_crestview_local' },
  });

  const crestviewAdminPassword = await hashPassword('CrestviewAdmin123!');
  await prisma.tenantUser.upsert({
    where: { tenantId_username: { tenantId: crestview.id, username: 'admin@crestview.edu' } },
    update: { passwordHash: crestviewAdminPassword, role: TenantUserRole.school_admin, isActive: true },
    create: { tenantId: crestview.id, username: 'admin@crestview.edu', passwordHash: crestviewAdminPassword, role: TenantUserRole.school_admin, isActive: true },
  });

  await prisma.siteContent.upsert({
    where: { tenantId_page: { tenantId: crestview.id, page: 'home' } },
    update: {},
    create: {
      tenantId: crestview.id,
      page: 'home',
      content: {
        heroHeading: 'Nurturing Global Leaders with Modern Innovation',
        heroSubheading: 'Empowering future innovators through world-class STEM education and holistic leadership development.',
      },
    },
  });

  // ─── Fee Items & Payments ──────────────────────────────────────────────
  console.log('\n[Fee Items] Seeding School Fee Structure & Payments...');
  const existingFeeItem = await prisma.feeItem.findFirst({
    where: { tenantId: apex.id, termId: terms['1st Term'], name: 'Tuition Fee - 1st Term' },
  });
  const tuitionFee = existingFeeItem || (await prisma.feeItem.create({
    data: {
      tenantId: apex.id,
      termId: terms['1st Term'],
      classLevelId: sss2Id,
      name: 'Tuition Fee - 1st Term',
      amount: 150000.00,
    },
  }));

  const samuelRecord = await prisma.student.findFirst({ where: { tenantId: apex.id, name: 'Samuel Adeyemi' } });
  if (samuelRecord) {
    const existingPayment = await prisma.feePayment.findFirst({
      where: { studentId: samuelRecord.id, termId: terms['1st Term'] },
    });
    if (!existingPayment) {
      await prisma.feePayment.create({
        data: {
          studentId: samuelRecord.id,
          termId: terms['1st Term'],
          amount: 150000.00,
          method: 'gateway',
          paymentRef: 'PAY-APEX-SAMUEL-001',
          paidAt: new Date(),
        },
      });
    }
  }

  // ─── Result PINs ────────────────────────────────────────────────────────
  console.log('\n[Result PINs] Seeding Result Checker PINs...');
  if (samuelRecord) {
    const existingPin = await prisma.resultPIN.findFirst({ where: { code: 'APEX-PIN-123456' } });
    if (!existingPin) {
      await prisma.resultPIN.create({
        data: {
          studentId: samuelRecord.id,
          termId: terms['1st Term'],
          code: 'APEX-PIN-123456',
          pricePaid: 1000.00,
          platformFee: 100.00,
          schoolNet: 900.00,
          paymentRef: 'PIN-BUY-001',
          expiresAt: new Date('2025-12-31'),
        },
      });
    }
  }

  console.log('  ✓ Seeded domain aliases, Crestview tenant, fee items & result PINs');

  console.log('\n🌱 All seed data populated successfully!');
  console.log('\nSeed Credentials:');
  console.log('  Super Admin:     admin@platform.com  / SuperAdmin123!');
  console.log('  Apex Admin:      admin@apex.edu      / ApexAdmin123!');
  console.log('  Apex Teacher:    teacher@apex.edu    / ApexTeacher123!');
  console.log('  Apex Parent:     parent@apex.edu     / ApexParent123!');
  console.log('  Apex Student:    student1            / ApexStudent123!');
  console.log('  Beacon Admin:    admin@beacon.edu    / BeaconAdmin123!');
  console.log('  Crestview Admin: admin@crestview.edu / CrestviewAdmin123!');
  console.log('\nDomain Routing Test Links (npm run dev):');
  console.log('  Apex Academy:     http://localhost:3000/apex      OR http://apex.localhost:3000');
  console.log('  Beacon College:   http://localhost:3000/beacon    OR http://beacon.localhost:3000');
  console.log('  Crestview Int:    http://localhost:3000/crestview OR http://crestview.localhost:3000');
  console.log('  Super Admin:      http://localhost:3000/admin');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
