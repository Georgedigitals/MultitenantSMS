import { prisma } from '../src/lib/prisma';

/**
 * Clean Demo Tenants Script
 * 
 * Removes the sample demo schools:
 * - apex
 * - beacon
 * - crestview
 * 
 * Preserves all platform plans, features, class levels, and super admin accounts.
 */
async function main() {
  console.log('🧹 Purging demo tenants (apex, beacon, crestview)...');

  const demoSlugs = ['apex', 'beacon', 'crestview'];

  for (const slug of demoSlugs) {
    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, name: true },
    });

    if (tenant) {
      console.log(`  Deleting demo tenant: ${tenant.name} (${slug})...`);
      await prisma.tenant.delete({
        where: { id: tenant.id },
      });
      console.log(`  ✓ Removed ${tenant.name}`);
    } else {
      console.log(`  - No demo tenant found with slug: ${slug}`);
    }
  }

  console.log('\n✅ Clean-up complete. The platform database is ready for real school onboarding!');
}

main()
  .catch((e) => {
    console.error('Error during demo tenant purge:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

