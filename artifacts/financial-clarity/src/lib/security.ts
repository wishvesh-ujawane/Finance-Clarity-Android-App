import type { BackupManifest } from '@/lib/types';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const PBKDF2_ITERATIONS = 160_000;

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function getRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

async function deriveAesKey(secret: string, saltBase64: string, iterations = PBKDF2_ITERATIONS) {
  const material = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: asArrayBuffer(fromBase64(saltBase64)),
      iterations,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function sha256Base64(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return toBase64(new Uint8Array(digest));
}

export async function createPinHash(pin: string, existingSalt?: string): Promise<{ hash: string; salt: string }> {
  const salt = existingSalt || toBase64(getRandomBytes(16));
  const digest = await sha256Base64(`${pin}:${salt}`);
  return { hash: digest, salt };
}

export async function verifyPin(pin: string, hash: string, salt: string): Promise<boolean> {
  if (!pin || !hash || !salt) return false;
  const computed = await sha256Base64(`${pin}:${salt}`);
  return computed === hash;
}

export async function encryptPayload<T extends object>(
  payload: T,
  secret: string,
  deviceId: string
): Promise<BackupManifest> {
  const salt = toBase64(getRandomBytes(16));
  const nonceBytes = getRandomBytes(12);
  const key = await deriveAesKey(secret, salt, PBKDF2_ITERATIONS);
  const plain = encoder.encode(JSON.stringify(payload));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: asArrayBuffer(nonceBytes) },
    key,
    plain
  );
  const ciphertext = toBase64(new Uint8Array(encrypted));
  const checksum = await sha256Base64(JSON.stringify(payload));

  const summarySource = payload as {
    transactions?: unknown[];
    categories?: unknown[];
    budgets?: unknown[];
    recurringEntries?: unknown[];
  };

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    deviceId,
    checksum,
    ciphertext,
    nonce: toBase64(nonceBytes),
    summary: {
      transactions: Array.isArray(summarySource.transactions) ? summarySource.transactions.length : 0,
      categories: Array.isArray(summarySource.categories) ? summarySource.categories.length : 0,
      budgets: Array.isArray(summarySource.budgets) ? summarySource.budgets.length : 0,
      recurringEntries: Array.isArray(summarySource.recurringEntries) ? summarySource.recurringEntries.length : 0,
    },
    kdfParams: {
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
  };
}

export async function decryptPayload<T>(manifest: BackupManifest, secret: string): Promise<T> {
  const key = await deriveAesKey(secret, manifest.kdfParams.salt, manifest.kdfParams.iterations);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: asArrayBuffer(fromBase64(manifest.nonce)) },
    key,
    asArrayBuffer(fromBase64(manifest.ciphertext))
  );
  return JSON.parse(decoder.decode(new Uint8Array(decrypted))) as T;
}
