import prisma from './prisma';
import { computeTotal, resolveGrade, previewGrade } from './grading';
import { ResultStatus } from '@prisma/client';
import { JobType } from '@prisma/client';
import { enqueueJob } from './queue/job-queue';
import { getTenantUrl } from './tenant-url';
import { getTenantCurriculum, resolveStudentSubjectIds } from './curriculum';
import {
  AFFECTIVE_TRAITS,
  PSYCHOMOTOR_TRAITS,
  isTraitRatingsComplete,
} from './report-card-domains';

function escapeEmailText(value: unknown): string {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return String(value ?? '').replace(/[&<>"']/g, (character) => entities[character]);
}

export interface CoverageSubjectSummary {
  subjectId: string;
  subjectName: string;
  teacherName: string;
  totalStudents: number;
  submittedCount: number;
  isComplete: boolean;
}

export interface ClassCoverageResult {
  isComplete: boolean;
  totalExpected: number;
  submittedCount: number;
  missingCount: number;
  studentsCount: number;
  subjects: CoverageSubjectSummary[];
  currentReview: {
    id: string;
    overallRemarks: string | null;
    submittedToAdminAt: Date | null;
    formTeacherName: string;
  } | null;
}

/**
 * Checks subject-by-subject submission coverage for a class level and term (§5.2).
 * Form teacher submission is strictly blocked until every assigned subject has reached 'submitted'.
 */
export async function checkClassSubmissionCoverage(
  tenantId: string,
  classLevelId: string,
  termId: string
): Promise<ClassCoverageResult> {
  const term = await prisma.term.findUnique({
    where: { id: termId },
  });
  if (!term) {
    throw new Error('Term not found or unauthorized');
  }
  const session = await prisma.academicSession.findUnique({
    where: { id: term.sessionId },
  });
  if (!session || session.tenantId !== tenantId) {
    throw new Error('Term not found or unauthorized');
  }

  const sessionId = term.sessionId;

  // 1. Get active enrollments and class info for this class
  const [classLevel, curriculumConfig, enrollments] = await Promise.all([
    prisma.classLevel.findUnique({ where: { id: classLevelId } }),
    getTenantCurriculum(tenantId),
    prisma.enrollment.findMany({
      where: {
        classLevelId,
        sessionId,
        status: 'active',
        student: { tenantId },
      },
      select: {
        studentId: true,
        student: { select: { id: true, guardianContactInfo: true } },
      },
    }),
  ]);
  const studentIds = enrollments.map((e: any) => e.studentId);
  const studentsCount = studentIds.length;

  // 2. Get teaching assignments (required subjects) for this class
  const rawAssignments = await prisma.teachingAssignment.findMany({
    where: {
      classLevelId,
      sessionId,
    },
  });

  const subjectIds = Array.from(new Set(rawAssignments.map((a: any) => a.subjectId))).filter(Boolean);
  const staffIds = Array.from(new Set(rawAssignments.map((a: any) => a.staffId))).filter(Boolean);

  const [subjectsList, staffList] = await Promise.all([
    subjectIds.length > 0 ? prisma.subject.findMany({ where: { id: { in: subjectIds } } }) : [],
    staffIds.length > 0 ? prisma.staff.findMany({ where: { id: { in: staffIds }, tenantId } }) : [],
  ]);

  const subjectMap = new Map<string, any>(subjectsList.map((s: any) => [s.id, s]));
  const staffMap = new Map<string, any>(staffList.map((st: any) => [st.id, st]));

  const uniqueSubjectsMap = new Map<string, { subjectName: string; teacherName: string }>();
  for (const a of rawAssignments) {
    const subj: any = subjectMap.get(a.subjectId);
    const st: any = staffMap.get(a.staffId);
    if (subj && st && !uniqueSubjectsMap.has(a.subjectId)) {
      uniqueSubjectsMap.set(a.subjectId, {
        subjectName: subj.name,
        teacherName: st.name,
      });
    }
  }

  const assignedClassSubjectIds = Array.from(uniqueSubjectsMap.keys());
  const teachingAssignmentsForClass = assignedClassSubjectIds.map((sid) => ({ subjectId: sid }));
  const studentSubjectSetMap = new Map<string, Set<string>>();
  for (const e of enrollments) {
    const resolvedIds = resolveStudentSubjectIds({
      classLevelId,
      classLevel,
      curriculum: curriculumConfig,
      studentContactInfo: e.student?.guardianContactInfo,
      teachingAssignmentsForClass,
    });
    studentSubjectSetMap.set(e.studentId, new Set(resolvedIds));
  }

  // 3. Query all result entries for these students and term
  const resultEntries = await prisma.resultEntry.findMany({
    where: {
      termId,
      studentId: { in: studentIds },
      subjectId: { in: assignedClassSubjectIds },
    },
    select: {
      studentId: true,
      subjectId: true,
      status: true,
    },
  });

  const entryKeySet = new Set<string>();
  for (const r of resultEntries) {
    if (['submitted', 'form_teacher_reviewed', 'published'].includes(r.status)) {
      entryKeySet.add(`${r.studentId}:${r.subjectId}`);
    }
  }

  const subjectsSummary: CoverageSubjectSummary[] = [];
  let totalSubmitted = 0;
  let totalExpected = 0;

  for (const [subjectId, meta] of uniqueSubjectsMap.entries()) {
    const expectedStudentsForSubject = studentIds.filter((sid: string) =>
      studentSubjectSetMap.get(sid)?.has(subjectId)
    );
    const subjectStudentCount = expectedStudentsForSubject.length;
    totalExpected += subjectStudentCount;

    let subSubmitted = 0;
    for (const sid of expectedStudentsForSubject) {
      if (entryKeySet.has(`${sid}:${subjectId}`)) {
        subSubmitted++;
      }
    }
    totalSubmitted += subSubmitted;
    subjectsSummary.push({
      subjectId,
      subjectName: meta.subjectName,
      teacherName: meta.teacherName,
      totalStudents: subjectStudentCount,
      submittedCount: subSubmitted,
      isComplete: subjectStudentCount === 0 ? studentsCount > 0 : subSubmitted === subjectStudentCount,
    });
  }

  const isComplete = studentsCount > 0 && uniqueSubjectsMap.size > 0 && totalSubmitted === totalExpected;

  // 4. Fetch current class review if exists
  const review = await prisma.classResultReview.findUnique({
    where: {
      classLevelId_termId: {
        classLevelId,
        termId,
      },
    },
  });

  let formTeacherName = 'Form Teacher';
  if (review?.formTeacherId) {
    const ft = await prisma.staff.findUnique({ where: { id: review.formTeacherId } });
    if (ft) formTeacherName = ft.name;
  }

  return {
    isComplete,
    totalExpected,
    submittedCount: totalSubmitted,
    missingCount: Math.max(0, totalExpected - totalSubmitted),
    studentsCount,
    subjects: subjectsSummary,
    currentReview: review
      ? {
          id: review.id,
          overallRemarks: review.overallRemarks,
          submittedToAdminAt: review.submittedToAdminAt,
          formTeacherName,
        }
      : null,
  };
}

/**
 * Saves or submits score entries for a subject teacher (§5.2, §5A.5).
 * Generates computed total and validates against active AssessmentComponents.
 */
export async function saveSubjectScores(options: {
  tenantId: string;
  teacherId: string;
  classLevelId: string;
  subjectId: string;
  termId: string;
  markAsSubmitted: boolean;
  entries: Array<{
    studentId: string;
    scores: Record<string, number | string>;
    comment?: string;
  }>;
}) {
  const { tenantId, teacherId, classLevelId, subjectId, termId, markAsSubmitted, entries } = options;

  // 1. Fetch active assessment components
  let components = await prisma.assessmentComponent.findMany({
    where: { tenantId, termId },
    orderBy: { orderIndex: 'asc' },
  });
  if (components.length === 0) {
    components = await prisma.assessmentComponent.findMany({
      where: { tenantId, termId: null },
      orderBy: { orderIndex: 'asc' },
    });
  }
  if (components.length === 0) {
    const { ensureTenantAcademicDefaults } = await import('./tenant');
    await ensureTenantAcademicDefaults(tenantId);
    components = await prisma.assessmentComponent.findMany({
      where: { tenantId, termId: null },
      orderBy: { orderIndex: 'asc' },
    });
  }
  if (components.length === 0) {
    throw new Error('No assessment components configured for school');
  }

  // 2. Enforce Academic Results Lock (§5.2, §11.4)
  // Edits after form_teacher_reviewed or published require an explicit logged reopen action.
  const studentIds = entries.map((e) => e.studentId);
  const lockedEntries = await prisma.resultEntry.findMany({
    where: {
      studentId: { in: studentIds },
      subjectId,
      termId,
      status: { in: [ResultStatus.form_teacher_reviewed, ResultStatus.published] },
    },
    take: 1,
  });

  if (lockedEntries.length > 0) {
    const lockedStatus = lockedEntries[0].status;
    throw new Error(
      `Cannot modify scores: Results for this class and subject are locked (${lockedStatus}). An explicit logged reopen action is required.`
    );
  }

  // 3. Process each student's scores
  const classLevel = await prisma.classLevel.findUnique({ where: { id: classLevelId } });
  const curriculum = await getTenantCurriculum(tenantId);
  const classOfferings = curriculum.classes[classLevelId] || [];

  const students = await prisma.student.findMany({
    where: { id: { in: studentIds }, tenantId },
    select: { id: true, guardianContactInfo: true },
  });
  const studentMap = new Map(students.map((s) => [s.id, s]));

  const savedEntries = [];
  for (const entry of entries) {
    if (classOfferings.length > 0) {
      const st = studentMap.get(entry.studentId);
      const studentSubjectIds = resolveStudentSubjectIds({
        classLevelId,
        classLevel,
        curriculum,
        studentContactInfo: st?.guardianContactInfo,
      });
      if (!studentSubjectIds.includes(subjectId)) {
        continue; // Skip saving score for student who is not offering this subject
      }
    }
    // Validate that scores do not exceed maxScore
    for (const comp of components) {
      const val = entry.scores[comp.id] ?? entry.scores[comp.name] ?? entry.scores[comp.name.toLowerCase()];
      if (val !== undefined && val !== null && val !== '') {
        const num = Number(val);
        if (isNaN(num) || num < 0 || num > comp.maxScore) {
          throw new Error(`Score for ${comp.name} must be between 0 and ${comp.maxScore}`);
        }
      }
    }

    const total = computeTotal(entry.scores, components);
    const scoreData = {
      ...entry.scores,
      total,
    };

    const status: ResultStatus = markAsSubmitted ? ResultStatus.submitted : ResultStatus.not_started;

    const record = await prisma.resultEntry.upsert({
      where: {
        studentId_subjectId_termId: {
          studentId: entry.studentId,
          subjectId,
          termId,
        },
      },
      update: {
        teacherId,
        scoreData,
        comment: entry.comment || null,
        status,
        grade: null, // Never stored before publish!
      },
      create: {
        studentId: entry.studentId,
        subjectId,
        termId,
        teacherId,
        scoreData,
        comment: entry.comment || null,
        status,
        grade: null,
      },
    });

    savedEntries.push(record);
  }

  return savedEntries;
}

/**
 * Form Teacher submits overall remarks and broadsheet to Admin (§5.2, §5.4).
 * Strictly blocked server-side if any subject in the class is not submitted.
 */
export async function submitFormTeacherReview(options: {
  tenantId: string;
  formTeacherId: string;
  classLevelId: string;
  termId: string;
  overallRemarks: string;
}) {
  const { tenantId, formTeacherId, classLevelId, termId, overallRemarks } = options;

  // 1. Verify submission coverage
  const coverage = await checkClassSubmissionCoverage(tenantId, classLevelId, termId);
  if (!coverage.isComplete) {
    throw new Error(
      `Cannot submit review to admin: ${coverage.missingCount} student score entries across assigned subjects are still missing or unsubmitted.`
    );
  }

  const term = await prisma.term.findFirst({
    where: { id: termId, session: { tenantId } },
    select: { sessionId: true },
  });
  if (!term) throw new Error('Term not found or unauthorized');

  // 2. Fetch class students
  const enrollments = await prisma.enrollment.findMany({
    where: {
      classLevelId,
      sessionId: term.sessionId,
      status: 'active',
      student: { tenantId },
    },
    select: { studentId: true },
  });
  const studentIds = enrollments.map((e: any) => e.studentId);

  // Submit the review and lock the related result entries atomically.
  const review = await prisma.$transaction(async (tx) => {
    const assessments = await tx.reportCardAssessment.findMany({
      where: { tenantId, classLevelId, termId, studentId: { in: studentIds } },
      select: { studentId: true, affectiveRatings: true, psychomotorRatings: true },
    });
    const assessmentMap = new Map(assessments.map((assessment) => [assessment.studentId, assessment]));
    const incompleteCount = studentIds.filter((studentId) => {
      const assessment = assessmentMap.get(studentId);
      return !assessment ||
        !isTraitRatingsComplete(assessment.affectiveRatings as Record<string, unknown>, AFFECTIVE_TRAITS) ||
        !isTraitRatingsComplete(assessment.psychomotorRatings as Record<string, unknown>, PSYCHOMOTOR_TRAITS);
    }).length;
    if (incompleteCount > 0) {
      throw new Error(`Cannot submit review: complete report card ratings for all ${incompleteCount} remaining student(s) first.`);
    }

    const savedReview = await tx.classResultReview.upsert({
      where: { classLevelId_termId: { classLevelId, termId } },
      update: {
        formTeacherId,
        overallRemarks: overallRemarks.trim(),
        submittedToAdminAt: new Date(),
      },
      create: {
        classLevelId,
        termId,
        formTeacherId,
        overallRemarks: overallRemarks.trim(),
        submittedToAdminAt: new Date(),
      },
    });

    await tx.resultEntry.updateMany({
      where: { termId, studentId: { in: studentIds }, status: 'submitted' },
      data: { status: 'form_teacher_reviewed' },
    });

    return savedReview;
  }, { isolationLevel: 'Serializable' });

  return review;
}

/**
 * School Admin publishes class results (§5.2, §5A.7).
 * At this exact moment, resolveGrade is called and the resulting letter grade is
 * frozen permanently into ResultEntry.grade.
 */
export async function publishClassResults(options: {
  tenantId: string;
  classLevelId: string;
  termId: string;
  subjectId?: string;
}) {
  const { tenantId, classLevelId, termId, subjectId } = options;

  const [targetClass, targetTerm] = await Promise.all([
    prisma.classLevel.findUnique({ where: { id: classLevelId } }),
    prisma.term.findFirst({ where: { id: termId, session: { tenantId } }, select: { id: true, sessionId: true } }),
  ]);
  if (!targetClass) {
    throw new Error('Class level not found');
  }
  if (!targetTerm) {
    throw new Error('Term not found or unauthorized');
  }

  // 1. Get students in class for this term's academic session
  const enrollments = await prisma.enrollment.findMany({
    where: {
      classLevelId,
      sessionId: targetTerm.sessionId,
      status: 'active',
      student: { tenantId },
    },
    select: { studentId: true },
  });
  const studentIds = enrollments.map((e: any) => e.studentId);

  // 2. Fetch submitted/reviewed result entries for these students (never publish unsubmitted not_started drafts as F)
  const entries = await prisma.resultEntry.findMany({
    where: {
      termId,
      studentId: { in: studentIds },
      status: { in: [ResultStatus.submitted, ResultStatus.form_teacher_reviewed, ResultStatus.published] },
      ...(subjectId ? { subjectId } : {}),
    },
  });

  if (entries.length === 0) {
    throw new Error(
      subjectId
        ? 'No result entries found to publish for this specific course in this class'
        : 'No result entries found to publish for this class'
    );
  }

  // 3. Fetch active grading scales for tenant
  const rawScales = await prisma.gradingScale.findMany({
    where: { tenantId },
    orderBy: { minScore: 'desc' },
  });

  const scaleClassIds = Array.from(new Set([
    ...rawScales.map((s: any) => s.lowestClassLevelId),
    ...rawScales.map((s: any) => s.highestClassLevelId),
  ])).filter(Boolean);

  const scaleClassLevels = scaleClassIds.length > 0
    ? await prisma.classLevel.findMany({ where: { id: { in: scaleClassIds } } })
    : [];
  const scaleClassMap = new Map(scaleClassLevels.map((c: any) => [c.id, c]));

  const scales = rawScales.map((s: any) => ({
    ...s,
    lowestClassLevel: scaleClassMap.get(s.lowestClassLevelId) || { orderIndex: 0 },
    highestClassLevel: scaleClassMap.get(s.highestClassLevelId) || { orderIndex: 99 },
  }));

  // 4. Calculate and permanently freeze grade on each record
  let publishedCount = 0;
  await prisma.$transaction(async (tx: any) => {
    for (const entry of entries) {
      const scoreObj = (entry.scoreData as Record<string, any>) || {};
      const total = typeof scoreObj.total === 'number' ? scoreObj.total : Number(scoreObj.total) || 0;

      const resolved = resolveGrade(total, targetClass.orderIndex, scales);
      const frozenGrade = resolved ? resolved.grade : 'F';

      await tx.resultEntry.update({
        where: { id: entry.id },
        data: {
          grade: frozenGrade,
          status: 'published',
        },
      });
      publishedCount++;
    }
  });

  // 5. Automated Multi-Channel delivery (SMS, WhatsApp, and Email)
  try {
    const smsConfig = await prisma.smsConfiguration.findUnique({
      where: { tenantId },
    });

    if (smsConfig?.autoResultAlert !== false) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true, slug: true },
      });
      const term = await prisma.term.findUnique({
        where: { id: termId },
        select: { name: true },
      });

      const students = await prisma.student.findMany({
        where: { id: { in: studentIds }, tenantId },
        select: {
          id: true,
          name: true,
          guardianContactInfo: true,
          guardians: { include: { guardian: { select: { name: true, contactInfo: true } } } },
        },
      });

      // 3. Dispatch multi-channel personalized alerts (SMS + WhatsApp + Email)
      for (const st of students) {
        const checkUrl = getTenantUrl(tenant?.slug || 'school', '/portal/results');
        const contacts = st.guardians.length > 0
          ? st.guardians.map((link: any) => ({
              info: (link.guardian.contactInfo as any) || {},
              name: link.guardian.name || null,
            }))
          : [{ info: (st.guardianContactInfo as any) || {}, name: null }];
        const notifiedEmails = new Set<string>();
        const notifiedPhones = new Set<string>();

        for (const contact of contacts) {
        const info = contact.info;
        const parentPhone = String(info.guardianPhone || info.phone || info.phoneNumber || '').trim();
        const parentEmail = String(info.guardianEmail || info.email || '').trim().toLowerCase();
        const guardianName = contact.name || info.guardianName || info.parentName || null;

        // A. SMS Alert
        if (parentPhone && !notifiedPhones.has(parentPhone)) {
          notifiedPhones.add(parentPhone);
          await enqueueJob({
            tenantId,
            type: JobType.notification_delivery,
            payload: {
              channel: 'sms',
              phone: parentPhone,
              message: `Dear ${guardianName || 'Parent'}, ${term?.name || 'Current Term'} results for ${st.name} at ${tenant?.name || 'School'} have been published. Sign in to the parent portal to view the report: ${checkUrl}`,
            },
            maxAttempts: 5,
          });

          // B. WhatsApp result alert: queue only when platform Meta credentials
          // and a configured approved template are present.
          const whatsappTemplate = process.env.WHATSAPP_RESULT_TEMPLATE;
          const whatsappConfigured = Boolean(
            whatsappTemplate && process.env.WHATSAPP_CLOUD_ACCESS_TOKEN &&
            process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_GRAPH_API_VERSION
          );
          const parameters = [guardianName || 'Parent', st.name, term?.name || 'Current Term', checkUrl];
          const whatsappLog = await prisma.whatsAppLog.create({
            data: {
              tenantId,
              phone: parentPhone,
              template: whatsappTemplate || 'result_published_alert',
              payload: { parameters },
              status: whatsappConfigured ? 'queued' : 'not_configured',
            },
            select: { id: true },
          });
          if (whatsappConfigured) {
            try {
              await enqueueJob({
                tenantId,
                type: JobType.notification_delivery,
                payload: { channel: 'whatsapp', phone: parentPhone, template: whatsappTemplate, parameters, logId: whatsappLog.id },
                maxAttempts: 5,
              });
            } catch {
              await prisma.whatsAppLog.updateMany({ where: { id: whatsappLog.id, tenantId }, data: { status: 'failed' } });
            }
          }
        }

        // C. Email Alert
        if (parentEmail && !notifiedEmails.has(parentEmail)) {
          notifiedEmails.add(parentEmail);
          await enqueueJob({
            tenantId,
            type: JobType.notification_delivery,
            payload: {
              channel: 'email',
              to: parentEmail,
              fromName: tenant?.name || 'School',
              subject: `${tenant?.name || 'School'}: ${term?.name || 'Current Term'} Results Published`,
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
                  <h2 style="color: #1e3a8a; margin-top: 0; font-size: 20px;">Results Published</h2>
                  <p style="font-size: 14px; color: #334155;">Dear ${escapeEmailText(guardianName || 'Parent')},</p>
                  <p style="font-size: 14px; color: #334155; line-height: 1.6;">
                    The <strong>${escapeEmailText(term?.name || 'Current Term')}</strong> academic results for <strong>${escapeEmailText(st.name)}</strong> have been reviewed and published by <strong>${escapeEmailText(tenant?.name || 'School Administration')}</strong>.
                  </p>
                  <p style="font-size: 14px; color: #334155;">Sign in to the parent portal to review and print the report card securely.</p>
                  <div style="text-align: center; margin: 24px 0;">
                    <a href="${escapeEmailText(checkUrl)}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 14px; display: inline-block;">Open Parent Portal →</a>
                  </div>
                  <p style="color: #94a3b8; font-size: 11px; text-align: center; margin-top: 24px;">© ${new Date().getFullYear()} ${escapeEmailText(tenant?.name || 'School')}. All rights reserved.</p>
                </div>
              `,
            },
            maxAttempts: 5,
          });
        }
        }
      }
    }
  } catch (smsErr) {
    console.error('[Auto Result Multi-Channel Error]', smsErr);
  }

  return { publishedCount };
}

/**
 * Bulk Publish results across multiple selected classes
 */
export async function bulkPublishClassResults(options: {
  tenantId: string;
  classLevelIds: string[];
  termId: string;
}) {
  const { tenantId, classLevelIds, termId } = options;
  let totalPublished = 0;
  const results: Array<{ classLevelId: string; success: boolean; count?: number; error?: string }> = [];

  for (const cid of classLevelIds) {
    try {
      const res = await publishClassResults({ tenantId, classLevelId: cid, termId });
      totalPublished += res.publishedCount;
      results.push({ classLevelId: cid, success: true, count: res.publishedCount });
    } catch (err: any) {
      results.push({ classLevelId: cid, success: false, error: err.message });
    }
  }

  return { totalPublished, results };
}

/**
 * School Admin reopens published or reviewed results (§5.2, §5A.7).
 * Creates a mandatory audit log entry and unlocks result entries.
 */
export async function reopenClassResults(options: {
  tenantId: string;
  userId: string;
  classLevelId: string;
  termId: string;
  reason: string;
}) {
  const { tenantId, userId, classLevelId, termId, reason } = options;

  if (!reason || reason.trim().length < 5) {
    throw new Error('A valid reason (minimum 5 characters) is required to reopen class results');
  }

  // 1. Log the reopen action in ResultAuditLog
  await prisma.resultAuditLog.create({
    data: {
      tenantId,
      userId,
      action: 'reopen_results',
      targetId: `${classLevelId}:${termId}`,
      reason: reason.trim(),
    },
  });

  // 2. Find students
  const enrollments = await prisma.enrollment.findMany({
    where: {
      classLevelId,
      status: 'active',
      student: { tenantId },
    },
    select: { studentId: true },
  });
  const studentIds = enrollments.map((e: any) => e.studentId);

  // 3. Unlock result entries back to submitted, unfreezing grade
  const updated = await prisma.resultEntry.updateMany({
    where: {
      termId,
      studentId: { in: studentIds },
      status: { in: ['form_teacher_reviewed', 'published'] },
    },
    data: {
      status: 'submitted',
      grade: null,
    },
  });

  // 4. Clear review submission timestamp
  await prisma.classResultReview.updateMany({
    where: {
      classLevelId,
      termId,
    },
    data: {
      submittedToAdminAt: null,
    },
  });

  return { reopenedCount: updated.count };
}
