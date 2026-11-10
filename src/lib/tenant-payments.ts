import crypto from 'node:crypto';
import prisma from '@/lib/prisma';

function encryptionKey() {
  const encoded = process.env.TENANT_SECRET_ENCRYPTION_KEY;
  if (!encoded) throw new Error('Tenant payment encryption is not configured.');
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32) throw new Error('TENANT_SECRET_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
  return key;
}

export function encryptTenantSecret(secret: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return `${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${encrypted.toString('base64')}`;
}

export function decryptTenantSecret(value: string) {
  const [ivPart, tagPart, cipherPart] = value.split('.');
  if (!ivPart || !tagPart || !cipherPart) throw new Error('Stored tenant payment credential is invalid.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivPart, 'base64'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(cipherPart, 'base64')), decipher.final()]).toString('utf8');
}

export async function getTenantPaystackSecret(tenantId: string) {
  const gateway = await prisma.tenantPaymentGateway.findUnique({ where: { tenantId } });
  if (!gateway?.enabled) return null;
  return decryptTenantSecret(gateway.paystackSecretCipher);
}

export function paystackKeyMode(secret: string) {
  if (secret.startsWith('sk_test_')) return 'test' as const;
  if (secret.startsWith('sk_live_')) return 'live' as const;
  return null;
}
