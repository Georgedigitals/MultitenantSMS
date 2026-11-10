import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import prisma from '../prisma';

export const SUPER_ADMIN_COOKIE_NAME = 'bms_sa_session';
const SESSION_EXPIRY_DAYS = 7;

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Creates a cryptographically random session token and stores its hash in `SuperAdminSession`.
 */
export async function createSuperAdminSession(superAdminId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await prisma.superAdminSession.create({
    data: {
      superAdminId,
      tokenHash,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

/**
 * Validates a Super Admin session token.
 * Returns the authenticated super admin or null.
 */
export async function validateSuperAdminSession(token: string) {
  if (!token) return null;

  try {
    const tokenHash = hashToken(token);
    const session = await prisma.superAdminSession.findUnique({
      where: { tokenHash },
      include: {
        superAdmin: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    if (!session) return null;

    // Check expiration
    if (new Date() > session.expiresAt) {
      await prisma.superAdminSession.delete({ where: { id: session.id } }).catch(() => {});
      return null;
    }

    return {
      superAdmin: session.superAdmin,
      session: { id: session.id, expiresAt: session.expiresAt },
    };
  } catch (error) {
    console.warn('[validateSuperAdminSession error]', error);
    return null;
  }
}

/**
 * Destroys a super admin session.
 */
export async function destroySuperAdminSession(token: string): Promise<void> {
  if (!token) return;
  const tokenHash = hashToken(token);
  await prisma.superAdminSession.deleteMany({
    where: { tokenHash },
  });
}

/**
 * Helper to get current Super Admin from request cookies in Server Components/Route Handlers.
 */
export async function getSuperAdminFromCookies() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SUPER_ADMIN_COOKIE_NAME)?.value;
  if (!token) return null;
  return validateSuperAdminSession(token);
}
