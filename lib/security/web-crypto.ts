/*
  Browser-only Web Crypto helpers for Guest BYOK.
  - AES-GCM 256 encryption/decryption
  - PBKDF2(SHA-256) key derivation for passphrase-based persistent storage
  - Simple in-memory, sessionStorage, and localStorage helpers

  IMPORTANT:
  - Never persist plaintext secrets.
  - For session scope, a tab-scoped random key is generated and kept only in memory.
  - For persistent scope, a user passphrase is required.
*/

export type EncryptBundle = {
  ciphertextB64: string;
  ivB64: string;
  saltB64?: string; // present when passphrase-based derivation is used
  alg: 'AES-GCM';
  v: 1; // versioning for future upgrades
};

const TEXT = 'utf-8';
const AES_ALG = 'AES-GCM';
const PBKDF2_ALG = 'PBKDF2';
const IV_BYTES = 12; // 96-bit IV recommended for GCM
const SALT_BYTES = 16;
const PBKDF2_ITER = 100_000;

function assertBrowserCrypto() {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error('Web Crypto API not available in this environment');
  }
}

// Encoding helpers
function enc(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}
function dec(buf: ArrayBuffer): string {
  return new TextDecoder(TEXT).decode(buf);
}
function toB64(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < u8.length; i++) binary += String.fromCharCode(u8[i]);
  return btoa(binary);
}
function fromB64(b64: string): Uint8Array {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function randomBytes(n: number): Uint8Array {
  assertBrowserCrypto();
  const buf = new Uint8Array(n);
  window.crypto.getRandomValues(buf);
  return buf;
}

export async function deriveKeyFromPassphrase(
  passphrase: string,
  salt: Uint8Array,
  iterations = PBKDF2_ITER
): Promise<CryptoKey> {
  assertBrowserCrypto();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc(passphrase) as BufferSource,
    PBKDF2_ALG,
    false,
    ['deriveKey']
  );
  return window.crypto.subtle.deriveKey(
    { name: PBKDF2_ALG, hash: 'SHA-256', salt: salt as BufferSource, iterations },
    keyMaterial,
    { name: AES_ALG, length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function importAesKeyRaw(raw: Uint8Array): Promise<CryptoKey> {
  assertBrowserCrypto();
  return window.crypto.subtle.importKey('raw', raw as BufferSource, { name: AES_ALG }, false, [
    'encrypt',
    'decrypt',
  ]);
}

export async function generateEphemeralAesKey(): Promise<CryptoKey> {
  assertBrowserCrypto();
  return window.crypto.subtle.generateKey({ name: AES_ALG, length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
}

export async function encryptWithKey(
  plaintext: string,
  key: CryptoKey,
  iv?: Uint8Array
): Promise<EncryptBundle> {
  assertBrowserCrypto();
  const ivBytes = iv ?? randomBytes(IV_BYTES);
  const ct = await window.crypto.subtle.encrypt(
    { name: AES_ALG, iv: ivBytes as BufferSource },
    key,
    enc(plaintext) as BufferSource
  );
  return { ciphertextB64: toB64(ct), ivB64: toB64(ivBytes), alg: AES_ALG, v: 1 };
}

export async function decryptWithKey(bundle: EncryptBundle, key: CryptoKey): Promise<string> {
  assertBrowserCrypto();
  const iv = fromB64(bundle.ivB64);
  const pt = await window.crypto.subtle.decrypt(
    { name: AES_ALG, iv: iv as BufferSource },
    key,
    fromB64(bundle.ciphertextB64) as BufferSource
  );
  return dec(pt);
}

export async function encryptWithPassphrase(
  plaintext: string,
  passphrase: string,
  iterations = PBKDF2_ITER
): Promise<EncryptBundle> {
  const salt = randomBytes(SALT_BYTES);
  const key = await deriveKeyFromPassphrase(passphrase, salt, iterations);
  const b = await encryptWithKey(plaintext, key);
  return { ...b, saltB64: toB64(salt) };
}

export async function decryptWithPassphrase(
  bundle: EncryptBundle,
  passphrase: string,
  iterations = PBKDF2_ITER
): Promise<string> {
  if (!bundle.saltB64) throw new Error('Missing salt for passphrase decryption');
  const salt = fromB64(bundle.saltB64);
  const key = await deriveKeyFromPassphrase(passphrase, salt, iterations);
  return decryptWithKey(bundle, key);
}

// Key masking for UI display
export function maskKey(key: string, visible = 4): string {
  if (!key) return '';
  const tail = key.slice(-visible);
  return `${key[0] ?? ''}${key[1] ?? ''}${key[2] ?? ''}${key[3] ?? ''}…${tail}`;
}

// Simple storage helpers
const MEM_STORE = new Map<string, { masked: string; bundle: EncryptBundle }>();
let MEM_AES_KEY: CryptoKey | null = null; // tab-ephemeral, not persisted
let SESSION_AES_KEY: CryptoKey | null = null; // not persisted

const SESSION_PREFIX = 'guestByok:session:';
const PERSIST_PREFIX = 'guestByok:persistent:';

export async function setMemoryCredential(provider: string, plaintextKey: string) {
  if (!MEM_AES_KEY) MEM_AES_KEY = await generateEphemeralAesKey();
  const bundle = await encryptWithKey(plaintextKey, MEM_AES_KEY);
  MEM_STORE.set(provider, { bundle, masked: maskKey(plaintextKey) });
  return { masked: maskKey(plaintextKey) };
}

// Returns non-sensitive metadata only
export function getMemoryCredential(provider: string): { masked: string } | null {
  const entry = MEM_STORE.get(provider);
  if (!entry) return null;
  return { masked: entry.masked };
}

// Decrypts the in-memory credential for active request use only
export async function getMemoryCredentialPlaintext(provider: string): Promise<string | null> {
  const entry = MEM_STORE.get(provider);
  if (!entry || !MEM_AES_KEY) return null;
  const plaintext = await decryptWithKey(entry.bundle, MEM_AES_KEY);
  return plaintext;
}

export async function setSessionCredential(provider: string, plaintextKey: string) {
  if (!SESSION_AES_KEY) SESSION_AES_KEY = await generateEphemeralAesKey();
  const bundle = await encryptWithKey(plaintextKey, SESSION_AES_KEY);
  sessionStorage.setItem(`${SESSION_PREFIX}${provider}`, JSON.stringify(bundle));
  return { masked: maskKey(plaintextKey) };
}

export async function getSessionCredential(provider: string): Promise<{ masked: string; plaintext: string } | null> {
  const raw = sessionStorage.getItem(`${SESSION_PREFIX}${provider}`);
  if (!raw) return null;
  if (!SESSION_AES_KEY) return null; // cannot decrypt without in-memory key
  
  let bundle: EncryptBundle;
  try {
    bundle = JSON.parse(raw) as EncryptBundle;
  } catch (error) {
    throw new Error(`Failed to parse session storage data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  const plaintext = await decryptWithKey(bundle, SESSION_AES_KEY);
  return { masked: maskKey(plaintext), plaintext };
}

export async function setPersistentCredential(
  provider: string,
  plaintextKey: string,
  passphrase: string
) {
  const bundle = await encryptWithPassphrase(plaintextKey, passphrase);
  localStorage.setItem(`${PERSIST_PREFIX}${provider}`, JSON.stringify(bundle));
  return { masked: maskKey(plaintextKey) };
}

export async function getPersistentCredential(
  provider: string,
  passphrase: string
): Promise<{ masked: string; plaintext: string } | null> {
  const raw = localStorage.getItem(`${PERSIST_PREFIX}${provider}`);
  if (!raw) return null;
  
  let bundle: EncryptBundle;
  try {
    bundle = JSON.parse(raw) as EncryptBundle;
  } catch (error) {
    throw new Error(`Failed to parse persistent storage data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  const plaintext = await decryptWithPassphrase(bundle, passphrase);
  return { masked: maskKey(plaintext), plaintext };
}

export function clearAllGuestCredentialsFor(provider: string) {
  MEM_STORE.delete(provider);
  sessionStorage.removeItem(`${SESSION_PREFIX}${provider}`);
  localStorage.removeItem(`${PERSIST_PREFIX}${provider}`);
}

