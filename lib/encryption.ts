import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;
  if (!envKey) {
    throw new Error('ENCRYPTION_KEY is required');
  }
  const key = Buffer.from(envKey, 'base64');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes long');
  }
  return key;
}

export function encryptKey(plaintext: string): {
  encrypted: string;
  iv: string;
} {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);

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

  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

export function maskKey(key: string): string {
  if (!key) {
    return '';
  }
  if (key.length < 8) {
    return '*'.repeat(key.length);
  }
  if (key.length === 8) {
    return '*'.repeat(8);
  }
  const prefix = key.slice(0, 4);
  const suffix = key.slice(-4);
  const maskedMiddle = '*'.repeat(Math.max(0, key.length - 8));
  return `${prefix}${maskedMiddle}${suffix}`;
}
