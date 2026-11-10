import bcrypt from 'bcryptjs';

const SALT_ROUNDS = process.env.NODE_ENV === 'production' ? 12 : 6;

/**
 * Hashes a plaintext password using bcrypt with 12 salt rounds (§11.2).
 */
export async function hashPassword(password: string): Promise<string> {
  const rounds = process.env.NODE_ENV === 'production' ? 12 : 4;
  return bcrypt.hash(password, rounds);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash || typeof hash !== 'string') {
    return false;
  }
  try {
    return await bcrypt.compare(password, hash);
  } catch (err) {
    console.warn('[verifyPassword] Compare error:', err);
    return false;
  }
}
