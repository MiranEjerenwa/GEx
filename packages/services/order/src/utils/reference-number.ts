import { randomBytes } from 'crypto';

const PREFIX = 'EGP-';
const ALPHANUMERIC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // excludes ambiguous chars: 0/O, 1/I
const CODE_LENGTH = 12;

/**
 * Generates a unique order reference number in the format "EGP-XXXXXXXXXXXX"
 * where X is an alphanumeric character (12 chars).
 *
 * Uses cryptographically random bytes to ensure unpredictability.
 */
export function generateReferenceNumber(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHANUMERIC[bytes[i] % ALPHANUMERIC.length];
  }
  return `${PREFIX}${code}`;
}
