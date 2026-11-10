import prisma from './prisma';

export interface AuditLogParams {
  tenantId: string;
  actorId?: string | null;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, any>;
  ipAddress?: string | null;
}

/**
 * Records an immutable audit event for a school tenant (§11.2).
 * Non-blocking safe: Errors are logged as warnings so primary transaction succeeds.
 */
export async function recordAuditLog(params: AuditLogParams): Promise<void> {
  try {
    const {
      tenantId,
      actorId = null,
      actorName,
      actorRole,
      action,
      entityType,
      entityId = null,
      details = {},
      ipAddress = null,
    } = params;

    if (!tenantId || !action || !actorName) {
      console.warn('[recordAuditLog] Missing required fields:', { tenantId, action, actorName });
      return;
    }

    await prisma.auditLog.create({
      data: {
        tenantId,
        actorId,
        actorName,
        actorRole,
        action,
        entityType,
        entityId,
        details,
        ipAddress,
      },
    });
  } catch (err: any) {
    console.warn('[recordAuditLog Error]', err?.message || err);
  }
}

export interface AuditLogFilterOptions {
  action?: string;
  actorRole?: string;
  entityType?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Retrieves paginated audit logs for a specific tenant with role and action filters.
 */
export async function getTenantAuditLogs(
  tenantId: string,
  options: AuditLogFilterOptions = {}
) {
  const {
    action,
    actorRole,
    entityType,
    search,
    page = 1,
    pageSize = 20,
  } = options;

  const skip = (Math.max(1, page) - 1) * pageSize;

  const where: any = { tenantId };

  if (action && action !== 'all') {
    where.action = action;
  }
  if (actorRole && actorRole !== 'all') {
    where.actorRole = actorRole;
  }
  if (entityType && entityType !== 'all') {
    where.entityType = entityType;
  }
  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { actorName: { contains: q, mode: 'insensitive' } },
      { action: { contains: q, mode: 'insensitive' } },
      { entityType: { contains: q, mode: 'insensitive' } },
      { entityId: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [logs, totalCount] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs,
    totalCount,
    totalPages: Math.ceil(totalCount / pageSize),
    currentPage: page,
  };
}
