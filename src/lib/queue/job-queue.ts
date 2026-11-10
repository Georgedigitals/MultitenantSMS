import prisma from '../prisma';
import { JobStatus, JobType } from '@prisma/client';
import { generateStudentReportCard } from '../report-card';
import { exportTenantDataJSON } from '../export';

export interface EnqueueJobOptions {
  tenantId: string;
  type: JobType;
  payload: Record<string, any>;
  maxAttempts?: number;
}

export interface JobFilterOptions {
  type?: JobType;
  status?: JobStatus;
  page?: number;
  pageSize?: number;
}

/** Enqueues work durably; the database poller will claim it even after restarts. */
export async function enqueueJob(options: EnqueueJobOptions) {
  const { tenantId, type, payload, maxAttempts = 3 } = options;

  if (!tenantId) {
    throw new Error('Tenant ID is required to enqueue a background job');
  }

  const job = await prisma.backgroundJob.create({
    data: {
      tenantId,
      type,
      payload: payload || {},
      status: JobStatus.queued,
      progress: 0,
      attempts: 0,
      maxAttempts,
    },
  });

  startBackgroundJobWorker();

  return job;
}

/**
 * Retrieves a background job's status and progress with strict tenant isolation.
 */
export async function getJobStatus(tenantId: string, jobId: string) {
  const job = await prisma.backgroundJob.findUnique({
    where: { id: jobId },
  });

  if (!job || job.tenantId !== tenantId) {
    throw new Error('Job not found or unauthorized');
  }

  return job;
}

/**
 * Lists background jobs for a tenant with optional status/type filtering and pagination.
 */
export async function listTenantJobs(tenantId: string, options: JobFilterOptions = {}) {
  const { type, status, page = 1, pageSize = 20 } = options;
  const skip = (page - 1) * pageSize;

  const where: any = { tenantId };
  if (type) where.type = type;
  if (status) where.status = status;

  const [jobs, totalCount] = await Promise.all([
    prisma.backgroundJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.backgroundJob.count({ where }),
  ]);

  return {
    jobs,
    totalCount,
    page,
    pageSize,
    totalPages: Math.ceil(totalCount / pageSize),
  };
}

/**
 * Retries a failed or stuck job.
 */
export async function retryJob(tenantId: string, jobId: string) {
  const job = await prisma.backgroundJob.findUnique({
    where: { id: jobId },
  });

  if (!job || job.tenantId !== tenantId) {
    throw new Error('Job not found or unauthorized');
  }

  if (job.status !== JobStatus.failed) {
    throw new Error('Only failed jobs can be manually retried');
  }

  const updated = await prisma.backgroundJob.update({
    where: { id: jobId },
    data: {
      status: JobStatus.queued,
      error: null,
      progress: 0,
      attempts: 0,
      startedAt: null,
      completedAt: null,
    },
  });

  return updated;
}

/**
 * Safely updates a background job record, returning null if the job was deleted or cancelled.
 */
async function safeUpdateJob(jobId: string, data: any) {
  try {
    return await prisma.backgroundJob.update({
      where: { id: jobId },
      data,
    });
  } catch (err: any) {
    if (err?.code === 'P2025') {
      return null;
    }
    throw err;
  }
}

/**
 * Worker processor that executes background jobs and tracks real-time progress.
 */
export async function processJob(jobId: string) {
  const claimed = await prisma.backgroundJob.updateMany({
    where: { id: jobId, status: JobStatus.queued },
    data: {
      status: JobStatus.processing,
      startedAt: new Date(),
      attempts: { increment: 1 },
      progress: 5,
    },
  });
  if (claimed.count !== 1) return;

  const job = await prisma.backgroundJob.findUnique({ where: { id: jobId } });
  if (!job) return;
  const heartbeat = setInterval(() => {
    void prisma.backgroundJob.updateMany({
      where: { id: jobId, status: JobStatus.processing },
      data: { updatedAt: new Date() },
    }).catch((error) => console.error(`[BackgroundJob Heartbeat Error] ${jobId}:`, error));
  }, 60_000);
  heartbeat.unref?.();

  try {
    let resultPayload: any = null;

    switch (job.type) {
      case JobType.bulk_report_cards: {
        resultPayload = await handleBulkReportCards(job);
        break;
      }
      case JobType.bulk_sms_dispatch: {
        resultPayload = await handleBulkSmsDispatch(job);
        break;
      }
      case JobType.bulk_whatsapp_dispatch: {
        resultPayload = await handleBulkWhatsAppDispatch(job);
        break;
      }
      case JobType.data_export: {
        resultPayload = await handleDataExport(job);
        break;
      }
      case JobType.notification_delivery: {
        resultPayload = await handleNotificationDelivery(job);
        break;
      }
      default:
        throw new Error(`Unsupported background job type: ${job.type}`);
    }

    // Mark completed
    await safeUpdateJob(jobId, {
      status: JobStatus.completed,
      progress: 100,
      result: resultPayload || {},
      completedAt: new Date(),
      error: null,
    });
  } catch (error: any) {
    if (error?.code === 'P2025') return; // Job was removed from database
    console.error(`[BackgroundJob Processor Failure] Job ID ${jobId}:`, error);

    const errorMessage = error?.message || 'Unknown background job failure';
    const currentAttempts = job.attempts;

    if (currentAttempts < job.maxAttempts) {
      // Requeue for automatic retry with backoff
      await safeUpdateJob(jobId, {
        status: JobStatus.queued,
        error: `Attempt ${currentAttempts} failed: ${errorMessage}. Queued for retry.`,
        updatedAt: new Date(Date.now() + Math.min(30 * 60_000, 10_000 * (2 ** Math.max(0, currentAttempts - 1)))),
      });
    } else {
      // Mark permanently failed
      await safeUpdateJob(jobId, {
        status: JobStatus.failed,
        error: errorMessage,
        completedAt: new Date(),
      });
      const failedPayload = job.payload as any;
      if (failedPayload?.channel === 'whatsapp' && failedPayload?.logId) {
        await prisma.whatsAppLog.updateMany({ where: { id: failedPayload.logId, tenantId: job.tenantId }, data: { status: 'failed' } });
      }
    }
  } finally {
    clearInterval(heartbeat);
  }
}

/** Dispatches a single durable email or SMS delivery attempt. Failed sends throw so
 * the normal job retry/failed-job tracking remains visible to school operators. */
async function handleNotificationDelivery(job: any) {
  const payload = job.payload as any;
  if (payload?.channel === 'email') {
    const { dispatchEmail } = await import('../email-service');
    const result = await dispatchEmail({
      tenantId: job.tenantId,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      fromName: payload.fromName,
    });
    if (!result.success) throw new Error('Email provider did not confirm delivery.');
    return { channel: 'email', providerMessageId: result.id, simulated: result.simulated === true };
  }
  if (payload?.channel === 'sms') {
    const { sendSms } = await import('../sms-service');
    const result = await sendSms({ tenantId: job.tenantId, phone: payload.phone, message: payload.message });
    if (!result.success) throw new Error(result.error || 'SMS provider did not confirm delivery.');
    return { channel: 'sms', provider: result.provider, providerMessageId: result.messageId };
  }
  if (payload?.channel === 'whatsapp') {
    const { sendWhatsAppTemplate } = await import('../whatsapp-service');
    const result = await sendWhatsAppTemplate({ phone: payload.phone, template: payload.template, parameters: payload.parameters });
    if (!result.success) {
      if (payload.logId) await prisma.whatsAppLog.updateMany({ where: { id: payload.logId, tenantId: job.tenantId }, data: { status: result.error?.includes('not configured') ? 'not_configured' : 'retrying' } });
      throw new Error(result.error || 'WhatsApp provider did not accept the template.');
    }
    if (payload.logId) await prisma.whatsAppLog.updateMany({ where: { id: payload.logId, tenantId: job.tenantId }, data: { status: 'accepted' } });
    return { channel: 'whatsapp', providerMessageId: result.providerMessageId };
  }
  throw new Error('Notification delivery job has an unsupported channel.');
}

const WORKER_GLOBAL_KEY = '__bmsJobWorker';
type WorkerGlobal = typeof globalThis & { __bmsJobWorker?: { timer: NodeJS.Timeout; running: boolean } };

/** Starts a single poller per Node process. Database claims coordinate replicas. */
export function startBackgroundJobWorker() {
  const workerGlobal = globalThis as WorkerGlobal;
  if (workerGlobal[WORKER_GLOBAL_KEY]) return;

  const worker = { timer: undefined as unknown as NodeJS.Timeout, running: false };
  worker.timer = setInterval(async () => {
    if (worker.running) return;
    worker.running = true;
    try {
      const staleBefore = new Date(Date.now() - 2 * 60 * 1000);
      await prisma.backgroundJob.updateMany({
        where: { status: JobStatus.processing, updatedAt: { lt: staleBefore } },
        data: { status: JobStatus.queued, startedAt: null, error: 'Recovered after worker interruption.' },
      });
      const queued = await prisma.backgroundJob.findMany({
        where: { status: JobStatus.queued, updatedAt: { lte: new Date() } },
        orderBy: { createdAt: 'asc' },
        take: 5,
        select: { id: true },
      });
      for (const job of queued) {
        await processJob(job.id);
      }
    } catch (error) {
      console.error('[BackgroundJob Poller Error]', error);
    } finally {
      worker.running = false;
    }
  }, 3_000);
  worker.timer.unref?.();
  workerGlobal[WORKER_GLOBAL_KEY] = worker;
}

/**
 * Handler for bulk student report card generation.
 */
async function handleBulkReportCards(job: any) {
  const { tenantId, id: jobId } = job;
  const payload = job.payload as any;
  const { classLevelId, termId } = payload;

  if (!classLevelId || !termId) {
    throw new Error('bulk_report_cards requires classLevelId and termId in payload');
  }

  // 1. Fetch active enrollments
  const enrollments = await prisma.enrollment.findMany({
    where: {
      classLevelId,
      status: 'active',
      student: { tenantId },
    },
    select: { studentId: true },
  });

  const totalStudents = enrollments.length;
  if (totalStudents === 0) {
    return {
      message: 'No active student enrollments found in this class',
      totalStudents: 0,
      generatedCount: 0,
    };
  }

  const generatedCards: any[] = [];
  let successfulCount = 0;
  let errorCount = 0;

  for (let i = 0; i < totalStudents; i++) {
    const studentId = enrollments[i].studentId;
    try {
      const card = await generateStudentReportCard(tenantId, studentId, termId);
      generatedCards.push({
        studentId,
        studentName: card.student.name,
        averageScore: card.summary.averageScore,
        position: card.summary.position,
      });
      successfulCount++;
    } catch (err: any) {
      errorCount++;
      generatedCards.push({
        studentId,
        error: err.message || 'Failed to generate report card',
      });
    }

    // Update progress periodically (every student or at percentage milestones)
    const progress = Math.min(95, Math.round(((i + 1) / totalStudents) * 90) + 5);
    await safeUpdateJob(jobId, { progress });
  }

  return {
    classLevelId,
    termId,
    totalStudents,
    generatedCount: successfulCount,
    errorCount,
    students: generatedCards,
  };
}

/**
 * Handler for bulk SMS dispatch.
 */
async function handleBulkSmsDispatch(job: any) {
  const { tenantId, id: jobId } = job;
  const payload = job.payload as any;
  const { recipients, message } = payload;

  if (!Array.isArray(recipients) || recipients.length === 0 || !message) {
    throw new Error('bulk_sms_dispatch requires recipients array and message string');
  }

  const { sendSms } = await import('../sms-service');
  const total = recipients.length;
  let sentCount = 0;
  let failedCount = 0;
  let lastError = '';

  for (let i = 0; i < total; i++) {
    const phone = recipients[i];
    const res = await sendSms({
      tenantId,
      phone,
      message,
    });
    if (res.success) {
      sentCount++;
    } else {
      failedCount++;
      if (res.error) lastError = res.error;
    }

    const progress = Math.min(95, Math.round(((i + 1) / total) * 90) + 5);
    await safeUpdateJob(jobId, { progress });
  }

  if (sentCount === 0 && failedCount > 0) {
    throw new Error(`All ${total} SMS delivery attempts failed: ${lastError || 'Gateway rejected delivery'}`);
  }

  return {
    totalRecipients: total,
    sentCount,
    failedCount,
    dispatchedAt: new Date(),
  };
}

/**
 * Handler for bulk WhatsApp dispatch.
 */
async function handleBulkWhatsAppDispatch(job: any) {
  const { tenantId, id: jobId } = job;
  const payload = job.payload as any;
  const { recipients, message } = payload;

  if (!Array.isArray(recipients) || recipients.length === 0 || !message) {
    throw new Error('bulk_whatsapp_dispatch requires recipients array and message string');
  }

  const total = recipients.length;
  let sentCount = 0;

  for (let i = 0; i < total; i++) {
    const phone = recipients[i];
    await prisma.whatsAppLog.create({
      data: {
        tenantId,
        phone,
        template: 'bulk_broadcast',
        payload: { message },
        status: 'not_configured',
      },
    });

    const progress = Math.min(95, Math.round(((i + 1) / total) * 90) + 5);
    await safeUpdateJob(jobId, { progress });
  }

  return {
    totalRecipients: total,
    sentCount,
    failedCount: total,
    note: 'WhatsApp provider is not configured; no messages were delivered.',
    dispatchedAt: new Date(),
  };
}

/**
 * Handler for asynchronous tenant data export.
 */
async function handleDataExport(job: any) {
  const { tenantId, id: jobId } = job;

  await safeUpdateJob(jobId, { progress: 30 });

  const dump = await exportTenantDataJSON(tenantId);

  await safeUpdateJob(jobId, { progress: 80 });

  return {
    exportReady: true,
    schemaVersion: dump.schemaVersion,
    exportedAt: dump.exportedAt,
    studentsCount: dump.students.length,
    staffCount: dump.staff.length,
    resultsCount: dump.academicResults.length,
    feePaymentsCount: dump.feePayments.length,
  };
}
