import prisma from './prisma';

/**
 * Resolves a student record within a tenant by either their primary key UUID or official admission number.
 * Fully resilient against stale Prisma Client in-memory DMMF schemas in long-running development servers.
 */
export async function findStudentByIdOrAdmissionNo(
  tenantId: string | null | undefined,
  rawIdentifier: string,
  options?: {
    select?: any;
    include?: any;
  }
) {
  const cleanId = (rawIdentifier || '').trim();
  if (!cleanId) return null;

  // 1. First try matching by primary key ID (fastest, standard index, zero schema dependency)
  try {
    const byId = await (prisma as any).student.findFirst({
      where: tenantId ? { tenantId, id: cleanId } : { id: cleanId },
      ...(options?.select ? { select: options.select } : {}),
      ...(options?.include ? { include: options.include } : {}),
    });
    if (byId) {
      return byId;
    }
  } catch (err: any) {
    if (!String(err?.message || '').includes('admissionNumber')) {
      console.warn('[findStudentByIdOrAdmissionNo byId error]', err?.message || err);
    }
  }

  // 2. Query raw SQL for admission_number or JSON guardian_contact_info->>admissionNo
  try {
    let rows: any[] = [];
    if (tenantId) {
      rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, admission_number as "admissionNumber"
         FROM students 
         WHERE tenant_id = $1 
           AND (
             admission_number = $2 
             OR admission_number ILIKE $2
             OR (guardian_contact_info IS NOT NULL AND guardian_contact_info->>'admissionNo' = $2)
           )
         LIMIT 1`,
        tenantId,
        cleanId
      );
    } else {
      rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, admission_number as "admissionNumber"
         FROM students 
         WHERE (
             admission_number = $2 
             OR admission_number ILIKE $2
             OR (guardian_contact_info IS NOT NULL AND guardian_contact_info->>'admissionNo' = $2)
           )
         LIMIT 1`,
        cleanId
      );
    }

    if (rows && rows.length > 0) {
      const canonicalId = rows[0].id;
      const student = await (prisma as any).student.findFirst({
        where: tenantId ? { tenantId, id: canonicalId } : { id: canonicalId },
        ...(options?.select ? { select: options.select } : {}),
        ...(options?.include ? { include: options.include } : {}),
      });
      if (student) {
        if (!student.admissionNumber && rows[0].admissionNumber) {
          student.admissionNumber = rows[0].admissionNumber;
        }
        return student;
      }
    }
  } catch (rawErr: any) {
    console.warn('[findStudentByIdOrAdmissionNo raw query error]', rawErr?.message || rawErr);
  }

  return null;
}
