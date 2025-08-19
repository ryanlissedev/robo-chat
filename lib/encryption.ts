import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY) {
  throw new Error('ENCRYPTION_KEY is required');
}
const ALGORITHM = 'aes-256-gcm';

// Accept either raw 32-byte key or base64-encoded 32-byte key for tests/dev
let key: Buffer;
try {
  const asBase64 = Buffer.from(ENCRYPTION_KEY ?? '', 'base64');
  key = asBase64.length === 32 ? asBase64 : Buffer.from(ENCRYPTION_KEY ?? '');
} catch {
  key = Buffer.from(ENCRYPTION_KEY ?? '');
}

const REQUIRED_KEY_BYTES = 32;
if (key.length !== REQUIRED_KEY_BYTES) {
  throw new Error('ENCRYPTION_KEY must be 32 bytes long');
}

export function encryptKey(plaintext: string): {
  encrypted: string;
  iv: string;
} {
  const IV_BYTES = 16;
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();
  const encryptedWithTag = `${encrypted}:${authTag.toString('hex')}`;

  return {
    encrypted: encryptedWithTag,
    iv: iv.toString('hex'),
  };
}

export function decryptKey(encryptedData: string, ivHex: string): string {
  const [encrypted, authTagHex] = encryptedData.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

export function maskKey(key: string): string {
  const MIN_MASK_LENGTH = 8;
  const VISIBLE = 4;
  if (key.length <= MIN_MASK_LENGTH) {
    return '*'.repeat(key.length);
  }
  return `${key.slice(0, VISIBLE)}${'*'.repeat(key.length - 2 * VISIBLE)}${key.slice(-VISIBLE)}`;
}
