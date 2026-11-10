import prisma from '@/lib/prisma';

/**
 * Auto-generates a clean, unique admission number for a student within a school tenant.
 *
 * Format: {PREFIX}/{YEAR}/{0001}
 * Examples:
 *   - Apex Academy in 2026: APEX/2026/0001
 *   - Beacon College in 2026: BEACON/2026/0001
 *   - Custom Prefix: BC/2026/0042
 */
export async function generateNextAdmissionNumber(
  tenantId: string,
  options?: {
    customPrefix?: string;
    sessionYear?: number | string;
    prismaClient?: any;
  }
): Promise<string> {
  const db = options?.prismaClient || prisma;

  // 1. Fetch tenant to get prefix or fallback to slug
  let rawPrefix: string = options?.customPrefix || '';
  if (!rawPrefix) {
    try {
      const tenant = await db.tenant.findUnique({
        where: { id: tenantId },
        select: { slug: true, admissionNumberPrefix: true },
      });
      rawPrefix = tenant?.admissionNumberPrefix || tenant?.slug || 'STU';
    } catch {
      try {
        const rows = await prisma.$queryRawUnsafe<any[]>(
          `SELECT slug, admission_number_prefix as "admissionNumberPrefix" FROM tenants WHERE id = $1 LIMIT 1`,
          tenantId
        );
        rawPrefix = rows[0]?.admissionNumberPrefix || rows[0]?.slug || 'STU';
      } catch {
        const tenant = await db.tenant.findUnique({
          where: { id: tenantId },
          select: { slug: true },
        });
        rawPrefix = tenant?.slug || 'STU';
      }
    }
  }

  const prefix = (rawPrefix || 'STU').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'STU';
  const year = options?.sessionYear || new Date().getFullYear();
  const baseSearch = `${prefix}/${year}/`;

  // Reserve a sequence atomically. The database stores the counter, but the
  // school prefix/year determine the human-facing format.
  const existingRows = await db.$queryRawUnsafe(
    `SELECT COALESCE(MAX(
       CASE WHEN admission_number ~ '/[0-9]+$'
            THEN substring(admission_number from '/([0-9]+)$')::int
            ELSE 0 END
     ), 0)::int + 1 AS next_value
     FROM students WHERE tenant_id = $1 AND admission_number LIKE $2`,
    tenantId,
    `${baseSearch}%`,
  ) as any[];
  const firstAvailable = Number(existingRows[0]?.next_value || 1);
  const counterRows = await db.$queryRawUnsafe(
    `INSERT INTO admission_number_counters (tenant_id, prefix, year, last_value)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (tenant_id, prefix, year)
     DO UPDATE SET last_value = GREATEST(admission_number_counters.last_value + 1, EXCLUDED.last_value)
     RETURNING last_value`,
    tenantId,
    prefix,
    Number(year),
    firstAvailable,
  ) as any[];
  const sequence = Number(counterRows[0]?.last_value);
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error('Could not reserve the next admission number. Apply the database migrations and try again.');
  }

  return `${baseSearch}${String(sequence).padStart(4, '0')}`;
}

/**
 * Backfills existing students who currently do not have an admission number.
 */
export async function backfillExistingStudentsAdmissionNumbers(tenantId?: string): Promise<{ updatedCount: number }> {
  let studentsWithoutAdmNo: any[] = [];
  try {
    const whereTenant = tenantId ? { tenantId, admissionNumber: null } : { admissionNumber: null };
    studentsWithoutAdmNo = await prisma.student.findMany({
      where: whereTenant,
      include: {
        tenant: { select: { id: true, slug: true, admissionNumberPrefix: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  } catch (err: any) {
    if (String(err?.message || '').includes('admissionNumber')) {
      if (tenantId) {
        studentsWithoutAdmNo = await prisma.$queryRawUnsafe<any[]>(
          `SELECT s.id, s.tenant_id as "tenantId", s.created_at as "createdAt" FROM students s WHERE s.tenant_id = $1 AND (s.admission_number IS NULL OR s.admission_number = '') ORDER BY s.created_at ASC`,
          tenantId
        );
      } else {
        studentsWithoutAdmNo = await prisma.$queryRawUnsafe<any[]>(
          `SELECT s.id, s.tenant_id as "tenantId", s.created_at as "createdAt" FROM students s WHERE (s.admission_number IS NULL OR s.admission_number = '') ORDER BY s.created_at ASC`
        );
      }
    } else {
      throw err;
    }
  }

  let updatedCount = 0;
  for (const s of studentsWithoutAdmNo) {
    const year = s.createdAt ? new Date(s.createdAt).getFullYear() : new Date().getFullYear();
    const admNo = await generateNextAdmissionNumber(s.tenantId, { sessionYear: year });
    try {
      await prisma.student.update({
        where: { id: s.id },
        data: { admissionNumber: admNo },
      });
    } catch (updateErr: any) {
      if (String(updateErr?.message || '').includes('admissionNumber')) {
        await prisma.$executeRawUnsafe(
          `UPDATE "students" SET "admission_number" = $1, "updated_at" = NOW() WHERE "id" = $2`,
          admNo,
          s.id
        );
      } else {
        throw updateErr;
      }
    }
    updatedCount++;
  }

  return { updatedCount };
}
