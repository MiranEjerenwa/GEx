import { randomBytes } from 'crypto';

const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No 0, O, 1, I to avoid confusion

/**
 * Generate a cryptographically random redemption code (12 alphanumeric characters).
 * Uses crypto.randomBytes for secure randomness.
 */
export function generateRedemptionCode(): string {
  const bytes = randomBytes(12);
  let code = '';
  for (let i = 0; i < 12; i++) {
    code += CHARSET[bytes[i] % CHARSET.length];
  }
  return code;
}
