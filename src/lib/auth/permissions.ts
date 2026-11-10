import { NextRequest, NextResponse } from 'next/server';
import prisma from '../prisma';
import { TenantUserRole } from '@prisma/client';
import { AuthenticatedTenantUser, getTenantUserFromCookies } from './tenant-auth';
import { getTenantContext, TenantContext } from '../tenant';

export type TenantPermission =
  // Academic / Assessment
  | 'scores:enter'
  | 'scores:review'
  | 'scores:publish'
  | 'scores:reopen'
  | 'broadsheet:view'
  // Attendance
  | 'attendance:mark'
  | 'attendance:view'
  // Administration
  | 'students:manage'
  | 'staff:manage'
  | 'assignments:manage'
  | 'curriculum:manage'
  | 'fees:manage'
  | 'fees:record_payment'
  | 'promotions:manage'
  | 'backups:manage'
  | 'jobs:manage'
  | 'settings:manage'
  | 'audit:view'
  // Student / Parent Portal
  | 'portal:own_results'
  | 'portal:own_fees'
  | 'portal:own_attendance';

export interface PermissionContext {
  classLevelId?: string;
  subjectId?: string;
  sessionId?: string;
  termId?: string;
  studentId?: string;
}

/**
 * Checks whether an authenticated tenant user has the requested permission,
 * applying contextual scoping (e.g. subject/class teaching assignments for teachers).
 */
export async function hasPermission(
  user: AuthenticatedTenantUser,
  permission: TenantPermission,
  context?: PermissionContext
): Promise<boolean> {
  if (!user || !user.tenantId) return false;

  // School administrators have full permissions within their tenant
  if (user.role === TenantUserRole.school_admin) {
    return true;
  }

  // Teacher permissions
  if (user.role === TenantUserRole.teacher) {
    if (!user.staffId) return false;

    switch (permission) {
      case 'scores:enter': {
        // If specific class, subject, and session are provided, verify teaching assignment
        if (context?.classLevelId && context?.subjectId && context?.sessionId) {
          const assignment = await prisma.teachingAssignment.findFirst({
            where: {
              staffId: user.staffId,
              classLevelId: context.classLevelId,
              subjectId: context.subjectId,
              sessionId: context.sessionId,
              staff: { tenantId: user.tenantId },
            },
          });
          return Boolean(assignment);
        }
        return true;
      }

      case 'scores:review': {
        // Only assigned form teacher for this class & session can review broadsheets
        if (context?.classLevelId && context?.sessionId) {
          const formAssignment = await prisma.formTeacherAssignment.findFirst({
            where: {
              staffId: user.staffId,
              classLevelId: context.classLevelId,
              sessionId: context.sessionId,
              staff: { tenantId: user.tenantId },
            },
          });
          return Boolean(formAssignment);
        }
        return false;
      }

      case 'broadsheet:view': {
        if (context?.classLevelId && context?.sessionId) {
          const isFormTeacher = await prisma.formTeacherAssignment.findFirst({
            where: {
              staffId: user.staffId,
              classLevelId: context.classLevelId,
              sessionId: context.sessionId,
              staff: { tenantId: user.tenantId },
            },
          });
          return Boolean(isFormTeacher);
        }
        return false;
      }

      case 'attendance:view':
      case 'jobs:manage':
        return true;

      case 'attendance:mark': {
        // Attendance marking is strictly reserved for the designated Form Teacher
        if (context?.classLevelId && context?.sessionId) {
          const isFormTeacher = await prisma.formTeacherAssignment.findFirst({
            where: {
              staffId: user.staffId,
              classLevelId: context.classLevelId,
              sessionId: context.sessionId,
              staff: { tenantId: user.tenantId },
            },
          });
          return Boolean(isFormTeacher);
        }
        return false;
      }

      // Teachers are explicitly forbidden from school-wide administrative mutations
      case 'scores:publish':
      case 'scores:reopen':
      case 'fees:manage':
      case 'fees:record_payment':
      case 'students:manage':
      case 'staff:manage':
      case 'assignments:manage':
      case 'curriculum:manage':
      case 'promotions:manage':
      case 'backups:manage':
      case 'settings:manage':
      case 'audit:view':
        return false;

      default:
        return false;
    }
  }

  // Student / Parent Portal permissions
  if (user.role === TenantUserRole.student || user.role === TenantUserRole.parent) {
    switch (permission) {
      case 'portal:own_results':
      case 'portal:own_fees':
      case 'portal:own_attendance': {
        if (context?.studentId && user.studentId) {
          return context.studentId === user.studentId;
        }
        return true;
      }
      default:
        return false;
    }
  }

  return false;
}

export interface TenantAuthSuccess {
  authorized: true;
  auth: NonNullable<Awaited<ReturnType<typeof getTenantUserFromCookies>>>;
  tenant: TenantContext;
}

export interface TenantAuthFailure {
  authorized: false;
  response: NextResponse;
}

export type TenantAuthResult = TenantAuthSuccess | TenantAuthFailure;

/**
 * Unified route authentication and authorization guard.
 * Extracts tenant context, validates session with expectedTenantId,
 * checks allowed roles, and verifies granular permissions with context.
 */
export async function requireTenantAuth(
  req: NextRequest,
  options?: {
    slug?: string;
    allowedRoles?: TenantUserRole[];
    requiredPermission?: TenantPermission;
    context?: PermissionContext;
  }
): Promise<TenantAuthResult> {
  const url = new URL(req.url);
  const slug = options?.slug || url.searchParams.get('slug');

  let tenant: TenantContext | null = null;
  if (slug) {
    tenant = await getTenantContext({ slug });
  } else {
    // Attempt host resolution
    const host = req.headers.get('host') || undefined;
    tenant = await getTenantContext({ domain: host });
  }

  if (!tenant) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Tenant school not found' }, { status: 404 }),
    };
  }

  // Strictly validate session scoped to this tenant
  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
    };
  }

  // Role validation
  if (options?.allowedRoles && !options.allowedRoles.includes(auth.user.role)) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Forbidden: Insufficient role privileges for this action' },
        { status: 403 }
      ),
    };
  }

  // Granular permission validation
  if (options?.requiredPermission) {
    const permitted = await hasPermission(auth.user, options.requiredPermission, options.context);
    if (!permitted) {
      return {
        authorized: false,
        response: NextResponse.json(
          { error: `Forbidden: User lacks '${options.requiredPermission}' permission for this resource` },
          { status: 403 }
        ),
      };
    }
  }

  return {
    authorized: true,
    auth,
    tenant,
  };
}
