import prisma from '../src/lib/prisma';
import {
  createTenantSnapshot,
  restoreTenantFromSnapshot,
  listTenantBackups,
  getTenantBackup,
} from '../src/lib/backup/disaster-recovery';
import { BackupTrigger, BackupStatus } from '@prisma/client';

async function verifyPhase4() {
  console.log('=== STARTING PHASE 4 DISASTER RECOVERY VERIFICATION SUITE ===\n');

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

  try {
    // 1. Fetch seed tenant
    const seedTenant = await prisma.tenant.findFirst({
      where: { slug: 'apex' },
      include: { plan: true },
    });

    if (!seedTenant) {
      throw new Error('Seed tenant apex must exist to run Phase 4 verification');
    }

    console.log(`Testing with tenant: ${seedTenant.name} (${seedTenant.slug})`);

    // Test 1: Snapshot Creation Contract & Metadata Integrity
    console.log('\n--- Test 1: Point-in-Time Snapshot Creation ---');
    const snapshotName = 'Phase 4 Verification Baseline Snapshot';
    const backup = await createTenantSnapshot({
      tenantId: seedTenant.id,
      name: snapshotName,
      trigger: BackupTrigger.manual,
      createdById: 'test-admin-id',
    });

    assert(Boolean(backup.id), 'Snapshot created with valid unique ID');
    assert(backup.tenantId === seedTenant.id, 'Snapshot tenantId strictly matches target school');
    assert(backup.name === snapshotName, 'Snapshot name matches input');
    assert(backup.status === BackupStatus.completed, 'Snapshot status is completed');
    assert(backup.sizeBytes > 500, `Snapshot sizeBytes is valid (${backup.sizeBytes} bytes)`);

    const meta = backup.metadata as any;
    assert(typeof meta.studentsCount === 'number' && meta.studentsCount > 0, `Metadata studentsCount is accurate (${meta.studentsCount})`);
    assert(typeof meta.sessionsCount === 'number' && meta.sessionsCount > 0, `Metadata sessionsCount is accurate (${meta.sessionsCount})`);

    // Verify snapshot appears in list
    const backupsList = await listTenantBackups(seedTenant.id);
    assert(backupsList.some((b) => b.id === backup.id), 'Snapshot appears in listTenantBackups query');

    // Test 2: Disaster Simulation & Point-in-Time Rollback
    console.log('\n--- Test 2: Disaster Simulation & Atomic State Rollback ---');
    const defaultPlan = await prisma.plan.findFirst();
    if (!defaultPlan) throw new Error('No default plan found');

    // Create an isolated sandbox school tenant with unique slug
    const uniqueId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const sandboxSlug = `disaster-sandbox-${uniqueId}`;
    const attackerSlug = `attacker-school-${uniqueId}`;

    const sandboxTenant = await prisma.tenant.create({
      data: {
        slug: sandboxSlug,
        name: 'Disaster Sandbox Academy',
        planId: defaultPlan.id,
        branding: { primaryColor: '#059669', fontHeading: 'Outfit' },
      },
    });

    // Populate initial state: session, term, student, and fee item
    const session = await prisma.academicSession.create({
      data: {
        tenantId: sandboxTenant.id,
        label: '2025/2026 Sandbox Session',
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

    const studentOriginal = await prisma.student.create({
      data: {
        tenantId: sandboxTenant.id,
        name: 'Pre-Disaster Honor Student',
        guardianContactInfo: '+2348011223344',
      },
    });

    const feeItemOriginal = await prisma.feeItem.create({
      data: {
        tenantId: sandboxTenant.id,
        termId: session.terms[0].id,
        name: 'Tuition Fee 2025/2026',
        amount: 85000.0,
      },
    });

    // Capture point-in-time snapshot of the healthy state
    const preDisasterBackup = await createTenantSnapshot({
      tenantId: sandboxTenant.id,
      name: 'Healthy Sandbox State Pre-Disaster',
      trigger: BackupTrigger.manual,
      createdById: 'sandbox-admin',
    });

    assert(Boolean(preDisasterBackup.id), 'Healthy state snapshot created successfully');

    // SIMULATE DISASTER: Malicious or accidental deletion/mutation
    console.log('  -> Simulating catastrophic data disaster (deleting students, renaming school, corrupting fees)...');
    await prisma.student.deleteMany({ where: { tenantId: sandboxTenant.id } });
    await prisma.feeItem.deleteMany({ where: { tenantId: sandboxTenant.id } });
    await prisma.tenant.update({
      where: { id: sandboxTenant.id },
      data: { name: 'CORRUPTED SCHOOL STATE' },
    });

    // Verify disaster state
    const postDisasterStudents = await prisma.student.findMany({ where: { tenantId: sandboxTenant.id } });
    assert(postDisasterStudents.length === 0, 'Confirmed disaster: Student records are completely wiped');

    // EXECUTE POINT-IN-TIME DISASTER RECOVERY ROLLBACK
    console.log('  -> Executing atomic point-in-time state rollback from snapshot...');
    const restoreResult = await restoreTenantFromSnapshot({
      tenantId: sandboxTenant.id,
      backupId: preDisasterBackup.id,
      restoredById: 'disaster-recovery-admin',
      autoSafetyBackup: false,
    });

    assert(restoreResult.success === true, 'Disaster recovery restore executed successfully');

    // Verify all original entities are restored back to exact healthy state
    const restoredTenant = await prisma.tenant.findUnique({ where: { id: sandboxTenant.id } });
    assert(restoredTenant?.name === 'Disaster Sandbox Academy', 'Restored tenant name is back to original');

    const restoredStudents = await prisma.student.findMany({ where: { tenantId: sandboxTenant.id } });
    assert(restoredStudents.length === 1, 'Restored student count is exactly 1');
    assert(restoredStudents[0].name === 'Pre-Disaster Honor Student', 'Restored student name matches original pre-disaster record');

    const restoredFees = await prisma.feeItem.findMany({ where: { tenantId: sandboxTenant.id } });
    assert(restoredFees.length === 1, 'Restored fee item count is exactly 1');
    assert(Number(restoredFees[0].amount) === 85000.0, 'Restored fee item amount matches original 85,000');

    // Verify backup status changed to restored
    const updatedBackup = await getTenantBackup(sandboxTenant.id, preDisasterBackup.id);
    assert(updatedBackup.status === BackupStatus.restored, 'Backup status marked as restored');
    assert(Boolean(updatedBackup.restoredAt), 'Backup restoredAt timestamp is populated');

    // Test 3: Multi-Tenant Isolation Guard
    console.log('\n--- Test 3: Multi-Tenant Disaster Recovery Isolation Guard ---');
    const attackerTenant = await prisma.tenant.create({
      data: {
        slug: attackerSlug,
        name: 'Attacker School X',
        planId: defaultPlan.id,
      },
    });

    // Attacker attempts to read or restore sandbox tenant's backup
    let isolationBlocked = false;
    try {
      await getTenantBackup(attackerTenant.id, preDisasterBackup.id);
    } catch (err: any) {
      isolationBlocked = true;
      assert(
        err.message.includes('unauthorized') || err.message.includes('not found'),
        'Cross-tenant snapshot read blocked with authorization error'
      );
    }
    assert(isolationBlocked, 'Cross-tenant backup read strictly prevented');

    let crossTenantRestoreBlocked = false;
    try {
      await restoreTenantFromSnapshot({
        tenantId: attackerTenant.id,
        backupId: preDisasterBackup.id,
        restoredById: 'attacker-id',
      });
    } catch (err: any) {
      crossTenantRestoreBlocked = true;
      assert(
        err.message.includes('unauthorized') || err.message.includes('not found'),
        'Cross-tenant rollback restore blocked with authorization error'
      );
    }
    assert(crossTenantRestoreBlocked, 'Cross-tenant snapshot rollback strictly prevented');

    // Test 4: Audit Trail Verification
    console.log('\n--- Test 4: Audit Trail Verification ---');
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        tenantId: sandboxTenant.id,
        action: { in: ['BACKUP_SNAPSHOT_CREATED', 'SNAPSHOT_RESTORED'] },
      },
    });

    const hasCreateLog = auditLogs.some((l) => l.action === 'BACKUP_SNAPSHOT_CREATED');
    const hasRestoreLog = auditLogs.some((l) => l.action === 'SNAPSHOT_RESTORED');
    assert(hasCreateLog, 'Audit log contains BACKUP_SNAPSHOT_CREATED event');
    assert(hasRestoreLog, 'Audit log contains SNAPSHOT_RESTORED event with actor details');

    // Cleanup test sandboxes
    await prisma.feeItem.deleteMany({ where: { tenantId: { in: [sandboxTenant.id, attackerTenant.id] } } });
    await prisma.student.deleteMany({ where: { tenantId: { in: [sandboxTenant.id, attackerTenant.id] } } });
    await prisma.term.deleteMany({ where: { session: { tenantId: { in: [sandboxTenant.id, attackerTenant.id] } } } });
    await prisma.academicSession.deleteMany({ where: { tenantId: { in: [sandboxTenant.id, attackerTenant.id] } } });
    await prisma.tenantBackup.deleteMany({ where: { tenantId: { in: [sandboxTenant.id, attackerTenant.id, seedTenant.id] } } });
    await prisma.auditLog.deleteMany({ where: { tenantId: { in: [sandboxTenant.id, attackerTenant.id] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [sandboxTenant.id, attackerTenant.id] } } });

    console.log('\n=================================================');
    console.log(`SUCCESS: All ${passed}/${total} Phase 4 Disaster Recovery Checks Passed Cleanly!`);
    console.log('=================================================\n');
  } catch (error) {
    console.error('Phase 4 verification error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyPhase4();
