import { decryptPayload, encryptPayload } from '@/lib/security';
import type { BackupManifest } from '@/lib/types';

const APP_KEY_PREFIX = 'financial-clarity';
const DEVICE_SECRET_KEY = `${APP_KEY_PREFIX}:device-secret`;

export function storageKey(key: string): string {
  return `${APP_KEY_PREFIX}:${key}`;
}

export function backupStorageKey(key: string): string {
  return `${APP_KEY_PREFIX}:backup:${key}:${Date.now()}`;
}

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getOrCreateDeviceSecret(): string {
  const existing = localStorage.getItem(DEVICE_SECRET_KEY);
  if (existing) return existing;
  const secret = createId();
  localStorage.setItem(DEVICE_SECRET_KEY, secret);
  return secret;
}

export async function saveEncryptedObject<T extends object>(key: string, value: T): Promise<void> {
  try {
    const secret = getOrCreateDeviceSecret();
    const manifest = await encryptPayload(value, secret, 'android-local');
    localStorage.setItem(storageKey(key), JSON.stringify(manifest));
    localStorage.removeItem(storageKey(`${key}:plaintext`));
  } catch {
    localStorage.setItem(storageKey(`${key}:plaintext`), JSON.stringify(value));
  }
}

export async function loadEncryptedObject<T>(key: string): Promise<T | null> {
  const raw = localStorage.getItem(storageKey(key));
  if (!raw) {
    const fallbackRaw = localStorage.getItem(storageKey(`${key}:plaintext`));
    if (!fallbackRaw) return null;
    try {
      return JSON.parse(fallbackRaw) as T;
    } catch {
      return null;
    }
  }
  try {
    const manifest = JSON.parse(raw) as BackupManifest;
    const secret = getOrCreateDeviceSecret();
    return await decryptPayload<T>(manifest, secret);
  } catch {
    const fallbackRaw = localStorage.getItem(storageKey(`${key}:plaintext`));
    if (!fallbackRaw) return null;
    try {
      return JSON.parse(fallbackRaw) as T;
    } catch {
      return null;
    }
  }
}

export function removeStorageKeys(keys: string[]): void {
  keys.forEach(key => localStorage.removeItem(storageKey(key)));
}
