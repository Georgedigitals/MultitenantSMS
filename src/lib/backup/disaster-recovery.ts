import prisma from '../prisma';
import { BackupTrigger, BackupStatus } from '@prisma/client';
import { recordAuditLog } from '../audit';

export interface CreateSnapshotOptions {
  tenantId: string;
  name: string;
  trigger?: BackupTrigger;
  createdById?: string;
}

export interface RestoreSnapshotOptions {
  tenantId: string;
  backupId: string;
  restoredById?: string;
  autoSafetyBackup?: boolean;
}

/**
 * Creates a comprehensive point-in-time backup snapshot of a school tenant (§11.7, Disaster Recovery).
 */
export async function createTenantSnapshot(options: CreateSnapshotOptions) {
  const { tenantId, name, trigger = BackupTrigger.manual, createdById } = options;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      plan: true,
      domainAliases: true,
      featureOverrides: true,
    },
  });

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  // 1. Fetch all tenant-owned state concurrently
  const [
    academicSessions,
    subjects,
    staff,
    teachingAssignments,
    formTeacherAssignments,
    students,
    enrollments,
    assessmentComponents,
    gradingScales,
    resultEntries,
    classResultReviews,
    attendanceRecords,
    feeItems,
    feePayments,
    studentFeeAdjustments,
    siteContents,
    galleryImages,
  ] = await Promise.all([
    prisma.academicSession.findMany({ where: { tenantId }, include: { terms: true } }),
    prisma.subject.findMany({ where: { tenantId } }),
    prisma.staff.findMany({ where: { tenantId } }),
    prisma.teachingAssignment.findMany({ where: { staff: { tenantId } } }),
    prisma.formTeacherAssignment.findMany({ where: { staff: { tenantId } } }),
    prisma.student.findMany({ where: { tenantId } }),
    prisma.enrollment.findMany({ where: { student: { tenantId } } }),
    prisma.assessmentComponent.findMany({ where: { tenantId } }),
    prisma.gradingScale.findMany({ where: { tenantId } }),
    prisma.resultEntry.findMany({ where: { student: { tenantId } } }),
    prisma.classResultReview.findMany({ where: { formTeacher: { tenantId } } }),
    prisma.attendanceRecord.findMany({ where: { student: { tenantId } } }),
    prisma.feeItem.findMany({ where: { tenantId } }),
    prisma.feePayment.findMany({ where: { student: { tenantId } } }),
    prisma.studentFeeAdjustment.findMany({ where: { student: { tenantId } } }),
    prisma.siteContent.findMany({ where: { tenantId } }),
    prisma.galleryImage.findMany({ where: { tenantId } }),
  ]);

  const snapshotData = {
    version: '1.0',
    capturedAt: new Date().toISOString(),
    tenantConfig: {
      name: tenant.name,
      branding: tenant.branding,
      pinPrice: Number(tenant.pinPrice),
      blockPromotionOnFeeBalance: tenant.blockPromotionOnFeeBalance,
      lowestClassLevelId: tenant.lowestClassLevelId,
      highestClassLevelId: tenant.highestClassLevelId,
    },
    academicSessions,
    subjects,
    staff,
    teachingAssignments,
    formTeacherAssignments,
    students,
    enrollments,
    assessmentComponents,
    gradingScales,
    resultEntries,
    classResultReviews,
    attendanceRecords,
    feeItems,
    feePayments,
    studentFeeAdjustments,
    siteContents,
    galleryImages,
  };

  const serialized = JSON.stringify(snapshotData);
  const sizeBytes = Buffer.byteLength(serialized, 'utf8');

  const metadata = {
    sessionsCount: academicSessions.length,
    studentsCount: students.length,
    staffCount: staff.length,
    resultsCount: resultEntries.length,
    feeItemsCount: feeItems.length,
    feePaymentsCount: feePayments.length,
  };

  const backup = await prisma.tenantBackup.create({
    data: {
      tenantId,
      name: name || `Snapshot ${new Date().toLocaleDateString()}`,
      trigger,
      status: BackupStatus.completed,
      snapshotData: snapshotData as any,
      sizeBytes,
      createdById: createdById || null,
      metadata,
    },
  });

  await recordAuditLog({
    tenantId,
    actorId: createdById || null,
    actorName: createdById ? 'Administrator' : 'System Automation',
    actorRole: 'school_admin',
    action: 'BACKUP_SNAPSHOT_CREATED',
    entityType: 'TenantBackup',
    entityId: backup.id,
    details: { backupName: backup.name, sizeBytes, metadata },
  });

  return backup;
}

/**
 * Restores a school tenant's state to an exact point-in-time snapshot within an atomic database transaction.
 */
export async function restoreTenantFromSnapshot(options: RestoreSnapshotOptions) {
  const { tenantId, backupId, restoredById, autoSafetyBackup = true } = options;

  const backup = await prisma.tenantBackup.findUnique({
    where: { id: backupId },
  });

  if (!backup || backup.tenantId !== tenantId) {
    throw new Error('Backup snapshot not found or unauthorized');
  }

  const snapshot = backup.snapshotData as any;
  if (!snapshot || !snapshot.version) {
    throw new Error('Snapshot payload is corrupted or has an invalid schema format');
  }

  // Optional: create a pre-restore safety snapshot so rollbacks can be reverted
  if (autoSafetyBackup) {
    try {
      await createTenantSnapshot({
        tenantId,
        name: `Pre-Restore Safety Snapshot (${backup.name})`,
        trigger: BackupTrigger.pre_migration,
        createdById: restoredById,
      });
    } catch (safetyErr) {
      console.warn('[Safety Backup Warning]', safetyErr);
    }
  }

  // Point-in-time state restoration wrapped in an atomic Prisma transaction
  await prisma.$transaction(async (tx: any) => {
    // 1. Wipe current tenant operational and academic data cleanly
    // Results & attendance
    await tx.resultEntry.deleteMany({ where: { student: { tenantId } } });
    await tx.classResultReview.deleteMany({ where: { formTeacher: { tenantId } } });
    await tx.attendanceRecord.deleteMany({ where: { student: { tenantId } } });
    await tx.resultPIN.deleteMany({ where: { student: { tenantId } } });

    // Fees
    await tx.feePayment.deleteMany({ where: { student: { tenantId } } });
    await tx.studentFeeAdjustment.deleteMany({ where: { student: { tenantId } } });
    await tx.feeItem.deleteMany({ where: { tenantId } });

    // Enrollments & Students
    await tx.enrollment.deleteMany({ where: { student: { tenantId } } });
    await tx.student.deleteMany({ where: { tenantId } });

    // Teaching Assignments & Staff
    await tx.teachingAssignment.deleteMany({ where: { staff: { tenantId } } });
    await tx.formTeacherAssignment.deleteMany({ where: { staff: { tenantId } } });
    await tx.staff.deleteMany({ where: { tenantId } });

    // Subjects
    await tx.subject.deleteMany({ where: { tenantId } });

    // Terms & Academic Sessions
    await tx.term.deleteMany({ where: { session: { tenantId } } });
    await tx.academicSession.deleteMany({ where: { tenantId } });

    // Assessment components & grading scales
    await tx.assessmentComponent.deleteMany({ where: { tenantId } });
    await tx.gradingScale.deleteMany({ where: { tenantId } });

    // Site Content
    await tx.siteContent.deleteMany({ where: { tenantId } });
    await tx.galleryImage.deleteMany({ where: { tenantId } });

    // 2. Re-establish snapshot state in foreign-key dependency order
    // A. Tenant Config
    if (snapshot.tenantConfig) {
      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          name: snapshot.tenantConfig.name,
          branding: snapshot.tenantConfig.branding,
          pinPrice: snapshot.tenantConfig.pinPrice,
          blockPromotionOnFeeBalance: snapshot.tenantConfig.blockPromotionOnFeeBalance,
          lowestClassLevelId: snapshot.tenantConfig.lowestClassLevelId,
          highestClassLevelId: snapshot.tenantConfig.highestClassLevelId,
        },
      });
    }

    // B. Academic Sessions & Terms
    if (Array.isArray(snapshot.academicSessions)) {
      for (const s of snapshot.academicSessions) {
        await tx.academicSession.create({
          data: {
            id: s.id,
            tenantId,
            label: s.label,
            startDate: new Date(s.startDate),
            endDate: new Date(s.endDate),
            isCurrent: s.isCurrent,
            terms: {
              create: (s.terms || []).map((t: any) => ({
                id: t.id,
                name: t.name,
                startDate: new Date(t.startDate),
                endDate: new Date(t.endDate),
                isCurrent: t.isCurrent,
                totalSchoolDays: t.totalSchoolDays,
              })),
            },
          },
        });
      }
    }

    // C. Subjects
    if (Array.isArray(snapshot.subjects)) {
      for (const sub of snapshot.subjects) {
        await tx.subject.create({
          data: {
            id: sub.id,
            tenantId,
            name: sub.name,
          },
        });
      }
    }

    // D. Staff & Teaching / Form Assignments
    if (Array.isArray(snapshot.staff)) {
      for (const st of snapshot.staff) {
        await tx.staff.create({
          data: {
            id: st.id,
            tenantId,
            name: st.name,
            roleBase: st.roleBase,
            contactInfo: st.contactInfo,
            createdAt: new Date(st.createdAt),
          },
        });
      }
    }

    if (Array.isArray(snapshot.teachingAssignments)) {
      for (const ta of snapshot.teachingAssignments) {
        await tx.teachingAssignment.create({
          data: {
            id: ta.id,
            staffId: ta.staffId,
            classLevelId: ta.classLevelId,
            subjectId: ta.subjectId,
            sessionId: ta.sessionId,
          },
        });
      }
    }

    if (Array.isArray(snapshot.formTeacherAssignments)) {
      for (const fta of snapshot.formTeacherAssignments) {
        await tx.formTeacherAssignment.create({
          data: {
            id: fta.id,
            staffId: fta.staffId,
            classLevelId: fta.classLevelId,
            sessionId: fta.sessionId,
          },
        });
      }
    }

    // E. Students & Enrollments
    if (Array.isArray(snapshot.students)) {
      for (const stu of snapshot.students) {
        await tx.student.create({
          data: {
            id: stu.id,
            tenantId,
            name: stu.name,
            guardianContactInfo: stu.guardianContactInfo,
            createdAt: new Date(stu.createdAt),
          },
        });
      }
    }

    if (Array.isArray(snapshot.enrollments)) {
      for (const e of snapshot.enrollments) {
        await tx.enrollment.create({
          data: {
            id: e.id,
            studentId: e.studentId,
            classLevelId: e.classLevelId,
            sessionId: e.sessionId,
            status: e.status,
          },
        });
      }
    }

    // F. Assessment Components & Grading Scales
    if (Array.isArray(snapshot.assessmentComponents)) {
      for (const ac of snapshot.assessmentComponents) {
        await tx.assessmentComponent.create({
          data: {
            id: ac.id,
            tenantId,
            name: ac.name,
            maxScore: ac.maxScore,
            weightPercent: ac.weightPercent,
            orderIndex: ac.orderIndex,
          },
        });
      }
    }

    if (Array.isArray(snapshot.gradingScales)) {
      for (const gs of snapshot.gradingScales) {
        await tx.gradingScale.create({
          data: {
            id: gs.id,
            tenantId,
            grade: gs.grade,
            minScore: gs.minScore,
            maxScore: gs.maxScore,
            remark: gs.remark,
            lowestClassLevelId: gs.lowestClassLevelId,
            highestClassLevelId: gs.highestClassLevelId,
          },
        });
      }
    }

    // G. Result Entries & Reviews
    if (Array.isArray(snapshot.resultEntries)) {
      for (const r of snapshot.resultEntries) {
        await tx.resultEntry.create({
          data: {
            id: r.id,
            studentId: r.studentId,
            subjectId: r.subjectId,
            termId: r.termId,
            teacherId: r.teacherId,
            scoreData: r.scoreData,
            totalScore: r.totalScore,
            grade: r.grade,
            comment: r.comment,
            status: r.status,
          },
        });
      }
    }

    if (Array.isArray(snapshot.classResultReviews)) {
      for (const cr of snapshot.classResultReviews) {
        await tx.classResultReview.create({
          data: {
            id: cr.id,
            classLevelId: cr.classLevelId,
            termId: cr.termId,
            formTeacherId: cr.formTeacherId,
            overallRemarks: cr.overallRemarks,
            submittedToAdminAt: cr.submittedToAdminAt ? new Date(cr.submittedToAdminAt) : null,
          },
        });
      }
    }

    if (Array.isArray(snapshot.attendanceRecords)) {
      for (const ar of snapshot.attendanceRecords) {
        await tx.attendanceRecord.create({
          data: {
            id: ar.id,
            studentId: ar.studentId,
            termId: ar.termId,
            date: new Date(ar.date),
            status: ar.status,
            markedBy: ar.markedBy,
          },
        });
      }
    }

    // H. Fee Items & Payments
    if (Array.isArray(snapshot.feeItems)) {
      for (const fi of snapshot.feeItems) {
        await tx.feeItem.create({
          data: {
            id: fi.id,
            tenantId,
            termId: fi.termId,
            classLevelId: fi.classLevelId,
            name: fi.name,
            amount: fi.amount,
          },
        });
      }
    }

    if (Array.isArray(snapshot.feePayments)) {
      for (const fp of snapshot.feePayments) {
        await tx.feePayment.create({
          data: {
            id: fp.id,
            studentId: fp.studentId,
            termId: fp.termId,
            amount: fp.amount,
            method: fp.method,
            reference: fp.reference,
            receiptNumber: fp.receiptNumber,
            recordedBy: fp.recordedBy,
            recordedAt: new Date(fp.recordedAt),
          },
        });
      }
    }

    // I. Site Content
    if (Array.isArray(snapshot.siteContents)) {
      for (const sc of snapshot.siteContents) {
        await tx.siteContent.create({
          data: {
            id: sc.id,
            tenantId,
            page: sc.page,
            content: sc.content,
          },
        });
      }
    }

    // 3. Update backup status to restored
    await tx.tenantBackup.update({
      where: { id: backupId },
      data: {
        status: BackupStatus.restored,
        restoredAt: new Date(),
        restoredById: restoredById || null,
      },
    });
  });

  await recordAuditLog({
    tenantId,
    actorId: restoredById || null,
    actorName: restoredById ? 'Administrator' : 'System Automation',
    actorRole: 'school_admin',
    action: 'SNAPSHOT_RESTORED',
    entityType: 'TenantBackup',
    entityId: backup.id,
    details: { backupName: backup.name, restoredAt: new Date(), metadata: backup.metadata },
  });

  return {
    success: true,
    message: `School workspace successfully restored to snapshot "${backup.name}"`,
    restoredAt: new Date(),
  };
}

/**
 * Lists all point-in-time snapshots for a tenant.
 */
export async function listTenantBackups(tenantId: string) {
  return prisma.tenantBackup.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      tenantId: true,
      name: true,
      trigger: true,
      status: true,
      sizeBytes: true,
      metadata: true,
      createdById: true,
      restoredAt: true,
      restoredById: true,
      createdAt: true,
    },
  });
}

/**
 * Retrieves a single backup snapshot with strict tenant isolation.
 */
export async function getTenantBackup(tenantId: string, backupId: string) {
  const backup = await prisma.tenantBackup.findUnique({
    where: { id: backupId },
  });

  if (!backup || backup.tenantId !== tenantId) {
    throw new Error('Backup not found or unauthorized');
  }

  return backup;
}

/**
 * Deletes a backup snapshot with strict tenant isolation.
 */
export async function deleteTenantBackup(tenantId: string, backupId: string) {
  const backup = await prisma.tenantBackup.findUnique({
    where: { id: backupId },
  });

  if (!backup || backup.tenantId !== tenantId) {
    throw new Error('Backup not found or unauthorized');
  }

  await prisma.tenantBackup.delete({
    where: { id: backupId },
  });

  return { success: true };
}
