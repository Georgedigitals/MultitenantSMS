import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/auth/passwords';

/**
 * Production System Seed
 * 
 * Sets up only system-required foundational data:
 * 1. Global Class Levels (Nursery 1 to SSS 3)
 * 2. System Feature Definitions
 * 3. Subscription Plans (Starter, Growth, Enterprise) & Feature Defaults
 * 4. Super Admin Credentials (for platform administration)
 * 
 * NO dummy schools, demo teachers, fake students, or mock data are created here.
 */
async function main() {
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL?.trim();
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;
  if (!superAdminEmail || !superAdminPassword || superAdminPassword.length < 16) {
    throw new Error('Set SUPER_ADMIN_EMAIL and a SUPER_ADMIN_PASSWORD of at least 16 characters before seeding.');
  }

  console.log('🌱 Starting Production System Seeding...');

  // ─── 1. Global ClassLevels ───────────────────────────────────────────────
  console.log('\n[1/4] Seeding global ClassLevels...');
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

  for (const level of classLevelsData) {
    await prisma.classLevel.upsert({
      where: { name: level.name },
      update: { orderIndex: level.orderIndex },
      create: level,
    });
  }
  console.log(`  ✓ ${classLevelsData.length} global class levels`);

  // ─── 2. Features ──────────────────────────────────────────────────────────
  console.log('\n[2/4] Seeding Platform Features...');
  const featuresData = [
    { key: 'custom_domain', name: 'Custom Domain', description: 'CNAME domain mapping for school branding' },
    { key: 'result_pins', name: 'Result PIN System', description: 'Paid result-checker PINs for parent/student access' },
    { key: 'school_fees', name: 'School Fee Tracking', description: 'Fee item ledger and payment reconciliation' },
    { key: 'gallery', name: 'Public Gallery', description: 'Media gallery on the public school portal' },
    { key: 'id_cards', name: 'Student & Staff ID Cards', description: 'Generate and print school identity cards' },
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
  console.log(`  ✓ ${featuresData.length} platform features`);

  // ─── 3. Subscription Plans ────────────────────────────────────────────────
  console.log('\n[3/4] Seeding Subscription Plans...');
  const plansData = [
    {
      id: 'plan_starter',
      name: 'Starter',
      studentCeiling: 200,
      price: 50000.0,
      pinRequired: true,
      platformFeePercent: 10.0,
      features: ['result_pins', 'notifications', 'feature_sms_alerts'],
    },
    {
      id: 'plan_growth',
      name: 'Growth',
      studentCeiling: 600,
      price: 120000.0,
      pinRequired: true,
      platformFeePercent: 8.0,
      features: ['result_pins', 'school_fees', 'gallery', 'notifications', 'feature_sms_alerts', 'feature_whatsapp_alerts', 'feature_cbt_exams'],
    },
    {
      id: 'plan_enterprise',
      name: 'Enterprise',
      studentCeiling: 2500,
      price: 250000.0,
      pinRequired: true,
      platformFeePercent: 5.0,
      features: ['custom_domain', 'result_pins', 'school_fees', 'gallery', 'notifications', 'grading_customization', 'feature_sms_alerts', 'feature_whatsapp_alerts', 'feature_cbt_exams', 'feature_bus_tracking'],
    },
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
  console.log(`  ✓ ${plansData.length} core subscription plans configured`);

  // ─── 4. Super Admin Account ───────────────────────────────────────────────
  console.log('\n[4/4] Ensuring Platform Super Admin account...');
  const superAdminPasswordHash = await hashPassword(superAdminPassword);

  await prisma.superAdmin.upsert({
    where: { email: superAdminEmail },
    update: { passwordHash: superAdminPasswordHash },
    create: { email: superAdminEmail, name: 'Platform Super Admin', passwordHash: superAdminPasswordHash },
  });
  console.log(`  ✓ Super Admin: ${superAdminEmail}`);

  console.log('\n✅ Clean Production System Seed Completed successfully!');
  console.log('Real schools can now register via /register with zero mock data clutter.');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
