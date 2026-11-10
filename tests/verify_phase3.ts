import prisma from '../src/lib/prisma';
import { enqueueJob, getJobStatus, listTenantJobs, retryJob } from '../src/lib/queue/job-queue';
import { JobStatus, JobType } from '@prisma/client';

async function verifyPhase3() {
  console.log('=== STARTING PHASE 3 VERIFICATION SUITE ===\n');

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
    // 1. Fetch default test tenant
    const tenant = await prisma.tenant.findFirst({
      where: { slug: 'apex' },
      include: { plan: true },
    });

    if (!tenant) {
      throw new Error('Seed tenant apex must exist to run Phase 3 verification');
    }

    console.log(`Testing with tenant: ${tenant.name} (${tenant.slug})`);

    // Test 1: Enqueue Job Contract
    console.log('\n--- Test 1: Background Job Enqueuing Contract ---');
    const job = await enqueueJob({
      tenantId: tenant.id,
      type: JobType.bulk_sms_dispatch,
      payload: {
        recipients: ['+2348011112222', '+2348033334444', '+2348055556666'],
        message: 'Term examination results published. Please check your parent portal.',
      },
    });

    assert(Boolean(job.id), 'Job successfully enqueued with unique ID');
    assert(job.tenantId === tenant.id, 'Job tenantId strictly matches calling tenant');
    assert(job.type === JobType.bulk_sms_dispatch, 'Job type is bulk_sms_dispatch');
    assert(job.status === JobStatus.queued || job.status === JobStatus.processing || job.status === JobStatus.completed, 'Initial job status is valid lifecycle state');

    // Test 2: Asynchronous Worker Execution & Progress Tracking
    console.log('\n--- Test 2: Worker Processing & Real-time Progress Tracking ---');
    // Poll until completed (timeout after 10s)
    let finalStatus: any = null;
    const startTime = Date.now();
    while (Date.now() - startTime < 10000) {
      finalStatus = await getJobStatus(tenant.id, job.id);
      if (finalStatus.status === JobStatus.completed || finalStatus.status === JobStatus.failed) {
        break;
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    assert(Boolean(finalStatus), 'Retrieved final job status');
    assert(finalStatus.status === JobStatus.completed, `Worker successfully executed job (status: ${finalStatus.status})`);
    assert(finalStatus.progress === 100, `Worker advanced progress to 100% (progress: ${finalStatus.progress})`);
    assert(Boolean(finalStatus.completedAt), 'CompletedAt timestamp is recorded');
    assert(finalStatus.result?.sentCount === 3, 'Result payload contains expected dispatched count (3)');

    // Verify SMS logs were actually written to database by worker
    const smsLogs = await prisma.smsLog.findMany({
      where: {
        tenantId: tenant.id,
        phone: { in: ['+2348011112222', '+2348033334444', '+2348055556666'] },
      },
    });
    assert(smsLogs.length === 3, 'Worker successfully persisted 3 SmsLog records into DB');

    // Test 3: Multi-Tenant Isolation Guard
    console.log('\n--- Test 3: Multi-Tenant Job Queue Isolation Guard ---');
    const defaultPlan = await prisma.plan.findFirst();
    if (!defaultPlan) throw new Error('No default plan found');

    const tenantA = await prisma.tenant.create({
      data: {
        slug: 'queue-test-school-a',
        name: 'Queue Test School A',
        planId: defaultPlan.id,
      },
    });

    const tenantB = await prisma.tenant.create({
      data: {
        slug: 'queue-test-school-b',
        name: 'Queue Test School B',
        planId: defaultPlan.id,
      },
    });

    const jobA = await enqueueJob({
      tenantId: tenantA.id,
      type: JobType.data_export,
      payload: { format: 'json' },
    });

    // Tenant B attempts to read Tenant A's job
    let crossTenantAccessBlocked = false;
    try {
      await getJobStatus(tenantB.id, jobA.id);
    } catch (err: any) {
      crossTenantAccessBlocked = true;
      assert(
        err.message.includes('unauthorized') || err.message.includes('not found'),
        'Tenant B reading Tenant A job throws authorization error'
      );
    }
    assert(crossTenantAccessBlocked, 'Cross-tenant job status check strictly blocked');

    // Tenant B listing jobs should see 0 jobs
    const tenantBJobs = await listTenantJobs(tenantB.id);
    assert(tenantBJobs.jobs.length === 0, 'Tenant B job list contains 0 jobs (no cross-tenant leakage)');

    // Wait for jobA to complete before moving to Test 4
    const waitJobA = Date.now();
    while (Date.now() - waitJobA < 8000) {
      const st = await getJobStatus(tenantA.id, jobA.id);
      if (st.status === JobStatus.completed) break;
      await new Promise((r) => setTimeout(r, 150));
    }

    // Test 4: Retry Mechanics for Failed Jobs
    console.log('\n--- Test 4: Retry Mechanics & Error Recovery ---');
    // Create an artificially failed job
    const failedJob = await prisma.backgroundJob.create({
      data: {
        tenantId: tenantA.id,
        type: JobType.bulk_sms_dispatch,
        status: JobStatus.failed,
        payload: { recipients: ['+2348099990000'], message: 'Test retry' },
        error: 'Simulated network timeout during dispatch',
        attempts: 3,
        maxAttempts: 3,
      },
    });

    assert(failedJob.status === JobStatus.failed, 'Created simulated failed job');

    const retriedJob = await retryJob(tenantA.id, failedJob.id);
    assert(retriedJob.status === JobStatus.queued || retriedJob.status === JobStatus.processing || retriedJob.status === JobStatus.completed, 'Job status reset to queued/processing on retry');
    assert(retriedJob.error === null, 'Job error message cleared on retry');
    assert(retriedJob.attempts === 0, 'Job attempts counter reset on retry');

    // Wait for retried job to complete
    const retryStart = Date.now();
    let finalRetried: any = null;
    while (Date.now() - retryStart < 10000) {
      finalRetried = await getJobStatus(tenantA.id, failedJob.id);
      if (finalRetried.status === JobStatus.completed) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    assert(finalRetried?.status === JobStatus.completed, 'Retried job successfully finished execution');

    // Cleanup test tenants and jobs
    await prisma.backgroundJob.deleteMany({
      where: { tenantId: { in: [tenantA.id, tenantB.id, tenant.id] } },
    });
    await prisma.smsLog.deleteMany({
      where: {
        tenantId: { in: [tenantA.id, tenantB.id, tenant.id] },
        phone: { in: ['+2348011112222', '+2348033334444', '+2348055556666', '+2348099990000'] },
      },
    });
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantA.id, tenantB.id] } },
    });

    console.log('\n=================================================');
    console.log(`SUCCESS: All ${passed}/${total} Phase 3 Queue Checks Passed Cleanly!`);
    console.log('=================================================\n');
  } catch (error) {
    console.error('Phase 3 verification suite error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyPhase3();
