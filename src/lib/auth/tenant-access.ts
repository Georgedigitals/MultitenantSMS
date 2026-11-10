import { getTenantContext, TenantContext } from '../tenant';
import { getTenantUserFromCookies, AuthenticatedTenantUser } from './tenant-auth';

export interface TenantAccessResult {
  authorized: boolean;
  tenant: TenantContext | null;
  user?: AuthenticatedTenantUser | null;
  error?: string;
  statusCode?: number;
}

/**
 * Ironclad authentication and authorization guard for tenant-scoped operations (§11.1, §11.2).
 * Strictly verifies the session cookie or active impersonation against the resolved tenant,
 * and enforces Role-Based Access Control (RBAC).
 */
export async function requireTenantAccess(
  slug: string,
  allowedRoles?: string[],
  overrideToken?: string
): Promise<TenantAccessResult> {
  if (!slug) {
    return { authorized: false, tenant: null, error: 'Tenant slug is required', statusCode: 400 };
  }

  const tenant = await getTenantContext({ slug });
  if (!tenant) {
    return { authorized: false, tenant: null, error: 'Tenant not found', statusCode: 404 };
  }

  // Strictly authenticate against the verified tenant session or authorized super admin impersonation
  const auth = await getTenantUserFromCookies(tenant.id, overrideToken);
  if (!auth) {
    return {
      authorized: false,
      tenant,
      user: null,
      error: 'Unauthorized: Session missing, expired, or invalid for this tenant',
      statusCode: 401,
    };
  }

  // Cross-tenant containment check
  if (auth.user.tenantId !== tenant.id) {
    return {
      authorized: false,
      tenant,
      user: null,
      error: 'Forbidden: Cross-tenant access is strictly denied',
      statusCode: 403,
    };
  }

  // Role-Based Access Control (RBAC) verification
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(auth.user.role)) {
    return {
      authorized: false,
      tenant,
      user: auth.user,
      error: `Forbidden: Role '${auth.user.role}' lacks sufficient privileges for this resource`,
      statusCode: 403,
    };
  }

  return {
    authorized: true,
    tenant,
    user: auth.user,
  };
}
