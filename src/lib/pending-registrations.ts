import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/auth/passwords';

export interface PendingRegistrationPayload {
  schoolName: string;
  slug: string;
  adminName: string;
  adminEmail: string;
  planId?: string;
  registrationMode?: 'trial' | 'paid';
  educationSystem?: string;
  lowestLevelName?: string;
  highestLevelName?: string;
  primaryColor?: string;
  accentColor?: string;
  logoUrl?: string | null;
  heroImageUrl?: string | null;
  motto?: string;
  heroSubheading?: string;
  templateId?: 'heritage' | 'vanguard' | 'horizon';
  galleryImages?: Array<{ title?: string; url: string; album?: string }>;
  sliderSlides?: Array<{
    title: string;
    subtitle?: string;
    imageUrl?: string;
    ctaText?: string;
    ctaLink?: string;
  }>;
}

export type StoredPendingRegistration = PendingRegistrationPayload & { passwordHash: string };

const PENDING_REGISTRATION_TTL_MS = 2 * 60 * 60 * 1000;

export async function savePendingRegistration(
  reference: string,
  payload: PendingRegistrationPayload & { password: string }
): Promise<void> {
  const cleanReference = reference.trim();
  const cleanSlug = payload.slug.trim().toLowerCase();
  if (!cleanReference || !cleanSlug || !payload.password) {
    throw new Error('A payment reference, tenant slug, and password are required.');
  }

  const { password, ...registrationData } = payload;
  const passwordHash = await hashPassword(password);
  await prisma.pendingRegistration.create({
    data: {
      reference: cleanReference,
      slug: cleanSlug,
      passwordHash,
      payload: registrationData,
      expiresAt: new Date(Date.now() + PENDING_REGISTRATION_TTL_MS),
    },
  });
}

export async function getPendingRegistration(referenceOrSlug: string): Promise<StoredPendingRegistration | null> {
  const key = referenceOrSlug.trim();
  if (!key) return null;

  const now = new Date();
  await prisma.pendingRegistration.deleteMany({ where: { expiresAt: { lte: now } } });
  const row = await prisma.pendingRegistration.findFirst({
    where: { expiresAt: { gt: now }, OR: [{ reference: key }, { slug: key.toLowerCase() }] },
    orderBy: { createdAt: 'desc' },
  });
  if (!row || typeof row.payload !== 'object' || row.payload === null || Array.isArray(row.payload)) return null;

  return { ...(row.payload as unknown as PendingRegistrationPayload), passwordHash: row.passwordHash };
}

export async function deletePendingRegistration(reference: string): Promise<void> {
  await prisma.pendingRegistration.deleteMany({ where: { reference: reference.trim() } });
}
