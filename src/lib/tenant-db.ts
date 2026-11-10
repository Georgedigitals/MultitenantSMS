import prisma from './prisma';
import type { PrismaClient } from '@prisma/client';

const TENANT_ID_MODELS = [
  'tenantFeatureOverride', 'domainAlias', 'academicSession', 'student', 'staff', 'subject',
  'reportCardAssessment', 'impersonationLog', 'feeItem', 'siteContent', 'galleryImage',
  'notification', 'tenantUser', 'tenantSession', 'assessmentComponent', 'gradingScale',
  'resultAuditLog', 'auditLog', 'smsConfiguration', 'emailConfiguration', 'smsLog',
  'whatsAppLog', 'cbtExam', 'transportVehicle', 'transportRoute', 'pinBatch',
  'generatedPin', 'backgroundJob', 'tenantBackup', 'pinSettlement', 'conversation', 'message', 'guardian',
  'feePaymentVerification', 'pinTransferVerification', 'tenantPaymentGateway', 'paymentIntent', 'staffAttendance', 'staffLeaveRequest', 'timetablePeriod',
  'timetableSlot',
] as const;

const RELATION_SCOPES: Record<string, object> = {
  enrollment: { student: { tenantId: '' } },
  teachingAssignment: { staff: { tenantId: '' } },
  formTeacherAssignment: { staff: { tenantId: '' } },
  resultEntry: { student: { tenantId: '' } },
  classResultReview: { term: { session: { tenantId: '' } } },
  attendanceRecord: { student: { tenantId: '' } },
  feePayment: { student: { tenantId: '' } },
  cbtQuestion: { exam: { tenantId: '' } },
  cbtStudentAttempt: { exam: { tenantId: '' }, student: { tenantId: '' } },
  studentFeeAdjustment: { AND: [{ student: { tenantId: '' } }, { feeItem: { tenantId: '' } }] },
  studentBusSubscription: { AND: [{ student: { tenantId: '' } }, { route: { tenantId: '' } }] },
};

function mergeScope(where: any, scope: object) {
  return where ? { AND: [where, scope] } : scope;
}

/**
 * Prisma's unique selectors require a unique field (for example `id`) at the
 * top level. Putting the tenant restriction only inside `AND` makes an
 * otherwise valid `findUnique`/`upsert` fail validation before it reaches the
 * database. Merge simple scopes beside the unique selector instead.
 */
function mergeUniqueScope(where: any, scope: any) {
  if (!where || typeof where !== 'object' || Array.isArray(where)) return where;
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) return where;

  const merged = { ...where };
  for (const [key, value] of Object.entries(scope)) {
    const existing = (merged as Record<string, any>)[key];
    if (existing && value && typeof existing === 'object' && typeof value === 'object' &&
      !Array.isArray(existing) && !Array.isArray(value)) {
      (merged as Record<string, any>)[key] = { AND: [existing, value] };
    } else {
      (merged as Record<string, any>)[key] = value;
    }
  }
  return merged;
}

function bindTenantId(scope: any, tenantId: string): any {
  if (Array.isArray(scope)) return scope.map((value) => bindTenantId(value, tenantId));
  if (!scope || typeof scope !== 'object') return scope;
  return Object.fromEntries(Object.entries(scope).map(([key, value]) => [
    key,
    key === 'tenantId' ? tenantId : bindTenantId(value, tenantId),
  ]));
}

function withTenantId(data: any, tenantId: string) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Tenant-scoped writes require an object payload.');
  }
  if (data.tenantId && data.tenantId !== tenantId) {
    throw new Error('Cross-tenant write rejected.');
  }
  return { ...data, tenantId };
}

async function verifyRelatedCreate(model: string, data: any, tenantId: string) {
  if (model === 'enrollment' && typeof data?.studentId === 'string') {
    const student = await prisma.student.findFirst({
      where: { id: data.studentId, tenantId },
      select: { id: true },
    });
    if (!student) throw new Error('Cross-tenant enrollment rejected.');
    return;
  }
  throw new Error(`Tenant-scoped ${model} create is not supported without verified tenant-owned relations.`);
}

function createScopedOperation(model: string, tenantId: string, relationScope?: object) {
  return async ({ operation, args, query }: { operation: string; args: any; query: (args: any) => Promise<any> }) => {
    const scope = relationScope ? bindTenantId(relationScope, tenantId) : { tenantId };
    const nextArgs = { ...args };

    if (['create', 'createMany', 'createManyAndReturn'].includes(operation)) {
      if (relationScope) {
        if (operation !== 'create') throw new Error(`Tenant-scoped ${model} bulk create is not supported.`);
        await verifyRelatedCreate(model, nextArgs.data, tenantId);
      } else if (Array.isArray(nextArgs.data)) {
        nextArgs.data = nextArgs.data.map((entry: any) => withTenantId(entry, tenantId));
      } else {
        nextArgs.data = withTenantId(nextArgs.data, tenantId);
      }
    } else if (operation === 'upsert') {
      if (relationScope) throw new Error(`Tenant-scoped ${model} upsert is not supported.`);
      nextArgs.where = mergeUniqueScope(nextArgs.where, scope);
      nextArgs.create = withTenantId(nextArgs.create, tenantId);
      nextArgs.update = withTenantId(nextArgs.update, tenantId);
    } else {
      if (['findUnique', 'findUniqueOrThrow', 'update', 'delete'].includes(operation)) {
        if (nextArgs.where === undefined) {
          throw new Error(`Tenant-scoped ${model} ${operation} requires a tenant filter.`);
        }
        nextArgs.where = mergeUniqueScope(nextArgs.where, scope);
      } else {
        if (relationScope && operation === 'deleteMany' && nextArgs.where === undefined) {
          throw new Error(`Tenant-scoped ${model} delete requires a tenant filter.`);
        }
        nextArgs.where = mergeScope(nextArgs.where, scope);
      }
      if (['update', 'updateMany', 'updateManyAndReturn'].includes(operation) && !relationScope) {
        nextArgs.data = withTenantId(nextArgs.data, tenantId);
      }
      if (['update', 'updateMany', 'updateManyAndReturn'].includes(operation) && relationScope && nextArgs.data?.tenantId) {
        throw new Error(`Tenant-scoped ${model} cannot be moved between tenants.`);
      }
    }

    return query(nextArgs);
  };
}

/**
 * Tenant-aware Prisma client for route and page code. It scopes all operations
 * on models with tenantId, and relation-owned records through their owning row.
 * Raw SQL remains intentionally unavailable through this client.
 */
export function getTenantDb(tenantId: string) {
  if (!tenantId) throw new Error('getTenantDb requires a verified, non-empty tenantId');

  const queryModels: Record<string, any> = {};
  for (const model of TENANT_ID_MODELS) {
    queryModels[model] = { $allOperations: createScopedOperation(model, tenantId) };
  }
  for (const [model, scope] of Object.entries(RELATION_SCOPES)) {
    queryModels[model] = { $allOperations: createScopedOperation(model, tenantId, scope) };
  }

  const extended = (prisma as any).$extends({ name: 'tenantIsolationExtension', query: queryModels });
  return denyUnscopedCapabilities(extended) as PrismaClient;
}

function denyUnscopedCapabilities(client: any): any {
  return new Proxy(client, {
    get(target, property, receiver) {
      if (property === '$queryRaw' || property === '$queryRawUnsafe' ||
          property === '$executeRaw' || property === '$executeRawUnsafe') {
        return () => { throw new Error('Raw SQL is unavailable from a tenant-scoped Prisma client.'); };
      }
      if (property === '$extends') {
        return () => { throw new Error('Adding Prisma extensions to a tenant-scoped client is not supported.'); };
      }
      const value = Reflect.get(target, property, target);
      if (property === '$transaction' && typeof value === 'function') {
        return (input: any, ...options: any[]) => {
          if (typeof input !== 'function') {
            throw new Error('Tenant-scoped clients support callback transactions only.');
          }
          return value.call(target, (tx: any) => input(denyUnscopedCapabilities(tx)), ...options);
        };
      }
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
