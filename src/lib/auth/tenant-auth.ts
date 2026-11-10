import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import prisma from '../prisma';
import { TenantUserRole } from '@prisma/client';
import { checkTrialAccess } from '@/lib/trial';

export const TENANT_COOKIE_NAME = 'bms_tenant_session';
const SESSION_EXPIRY_DAYS = 7;

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Creates a cryptographically random session token for a tenant user (§11.2).
 */
export async function createTenantSession(
  tenantId: string,
  userId: string
): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await prisma.tenantSession.create({
    data: {
      tenantId,
      userId,
      tokenHash,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export interface AuthenticatedTenantUser {
  id: string;
  tenantId: string;
  username: string;
  role: TenantUserRole;
  staffId: string | null;
  studentId: string | null;
  avatarUrl?: string | null;
  staffProfile?: {
    id: string;
    name: string;
    roleBase: string;
  } | null;
  studentProfile?: {
    id: string;
    name: string;
  } | null;
}

/**
 * Validates a tenant session token against the EXPECTED tenant ID (§11.1).
 * If the session exists but belongs to a different school/tenant, returns null (401).
 */
export async function validateTenantSession(
  expectedTenantId: string | undefined,
  token: string,
  options: { allowExpiredTrial?: boolean } = {},
): Promise<{ user: AuthenticatedTenantUser; tenant: { id: string }; sessionId: string } | null> {
  if (!token) return null;

  try {
    const tokenHash = hashToken(token);
    const session = await prisma.tenantSession.findUnique({
      where: { tokenHash },
    });

    if (!session) return null;
    if (expectedTenantId && session.tenantId !== expectedTenantId) return null;
    if (new Date() > session.expiresAt) {
      await prisma.tenantSession.delete({ where: { id: session.id } }).catch(() => {});
      return null;
    }

    const user = await prisma.tenantUser.findUnique({
      where: { id: session.userId },
    });

    if (!user || user.tenantId !== session.tenantId) return null;

    let staffProfile: any = null;
    let studentProfile: any = null;

    if (user.staffId) {
      staffProfile = await prisma.staff.findUnique({
        where: { id: user.staffId, tenantId: session.tenantId },
        select: { id: true, name: true, roleBase: true, contactInfo: true },
      }).catch(() => null);
    }

    if (user.studentId) {
      studentProfile = await prisma.student.findUnique({
        where: { id: user.studentId, tenantId: session.tenantId },
        select: { id: true, name: true, guardianContactInfo: true },
      }).catch(() => null);
    }

    const avatarUrl =
      (staffProfile?.contactInfo as any)?.avatarUrl ||
      (studentProfile?.guardianContactInfo as any)?.avatarUrl ||
      null;

    // Enforce tenant boundary if expectedTenantId is provided (§11.1)
    if (!options.allowExpiredTrial) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: { status: true, trialEndsAt: true },
      });
      if (!tenant || !checkTrialAccess(tenant).allowed) return null;
    }

    // Check expiration
    if (!user.isActive) {
      await prisma.tenantSession.delete({ where: { id: session.id } }).catch(() => {});
      return null;
    }

    return {
      sessionId: session.id,
      tenant: { id: user.tenantId },
      user: {
        id: user.id,
        tenantId: user.tenantId,
        username: user.username,
        role: user.role,
        staffId: user.staffId,
        studentId: user.studentId,
        avatarUrl,
        staffProfile: staffProfile ? { id: staffProfile.id, name: staffProfile.name, roleBase: staffProfile.roleBase } : null,
        studentProfile: studentProfile ? { id: studentProfile.id, name: studentProfile.name } : null,
      },
    };
  } catch (error) {
    console.warn('[validateTenantSession error]', error);
    return null;
  }
}

/**
 * Destroys a tenant session by token.
 */
export async function destroyTenantSession(token: string): Promise<void> {
  if (!token) return;
  const tokenHash = hashToken(token);
  await prisma.tenantSession.deleteMany({
    where: { tokenHash },
  });
}

/**
 * Invalidates all active sessions for a user, optionally preserving one current session.
 * Used during password change, account suspension, or role re-assignment.
 */
export async function invalidateUserSessions(
  userId: string,
  exceptSessionId?: string
): Promise<number> {
  const result = await prisma.tenantSession.deleteMany({
    where: {
      userId,
      ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
    },
  });
  return result.count;
}

/**
 * Rotates an existing session token for enhanced security.
 * Replaces the old session token hash with a fresh cryptographically random token.
 */
export async function rotateTenantSession(
  oldToken: string
): Promise<{ token: string; expiresAt: Date } | null> {
  if (!oldToken) return null;
  const oldHash = hashToken(oldToken);

  const existing = await prisma.tenantSession.findUnique({
    where: { tokenHash: oldHash },
  });

  if (!existing || new Date() > existing.expiresAt) {
    return null;
  }

  const newToken = crypto.randomBytes(32).toString('hex');
  const newTokenHash = hashToken(newToken);
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await prisma.tenantSession.update({
    where: { id: existing.id },
    data: {
      tokenHash: newTokenHash,
      expiresAt,
    },
  });

  return { token: newToken, expiresAt };
}

/**
 * Removes expired sessions from the database for a tenant or globally.
 */
export async function cleanupStaleSessions(tenantId?: string): Promise<number> {
  const result = await prisma.tenantSession.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
      ...(tenantId ? { tenantId } : {}),
    },
  });
  return result.count;
}

export async function getTenantUserFromCookies(
  expectedTenantId?: string,
  overrideToken?: string,
  options: { allowExpiredTrial?: boolean } = {},
) {
  let cookieStore: any = null;
  try {
    cookieStore = await cookies();
  } catch {
    // Outside of request scope (e.g. unit tests, CLI workers)
  }

  const token = overrideToken || cookieStore?.get?.(TENANT_COOKIE_NAME)?.value;
  if (token) {
    const session = await validateTenantSession(expectedTenantId, token, options);
    if (session) return session;
  }

  return null;
}
