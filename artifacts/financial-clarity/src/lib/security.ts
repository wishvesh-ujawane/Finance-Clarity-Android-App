const SECURITY_STORAGE_KEY = 'financial-clarity:security';
const DATA_KEY_PREFIX = 'financial-clarity:';
const DEFAULT_LOCK_TIMEOUT_MS = 30_000;

export interface SecuritySettings {
  pinHash: string;
  pinSalt: string;
  biometricEnabled: boolean;
  lockTimeoutMs: number;
  updatedAt: number;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isValidSettings(value: unknown): value is SecuritySettings {
  return (
    isObject(value) &&
    typeof value.pinHash === 'string' && value.pinHash.length > 0 &&
    typeof value.pinSalt === 'string' && value.pinSalt.length > 0 &&
    typeof value.biometricEnabled === 'boolean' &&
    typeof value.lockTimeoutMs === 'number' && Number.isFinite(value.lockTimeoutMs) &&
    typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt)
  );
}

function bytesToHex(bytes: Uint8Array): string {
  let result = '';
  for (let i = 0; i < bytes.length; i++) {
    result += bytes[i].toString(16).padStart(2, '0');
  }
  return result;
}

export function generateSalt(byteLength = 16): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(digest));
}

export function loadSecuritySettings(): SecuritySettings | null {
  try {
    const raw = localStorage.getItem(SECURITY_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidSettings(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export type SecurityStorageResult = { ok: true } | { ok: false; message: string };

export function saveSecuritySettings(settings: SecuritySettings): SecurityStorageResult {
  try {
    localStorage.setItem(SECURITY_STORAGE_KEY, JSON.stringify(settings));
    return { ok: true };
  } catch {
    return { ok: false, message: 'Could not save security settings. Your previous settings are unchanged. Check device storage and try again.' };
  }
}

export function clearSecuritySettings(): SecurityStorageResult {
  try {
    localStorage.removeItem(SECURITY_STORAGE_KEY);
    return { ok: true };
  } catch {
    return { ok: false, message: 'Could not remove security settings. Your app lock is still enabled. Check device storage and try again.' };
  }
}

export async function verifyPin(pin: string, settings: SecuritySettings): Promise<boolean> {
  const hash = await hashPin(pin, settings.pinSalt);
  return hash === settings.pinHash;
}

export async function createSecuritySettings(pin: string, overrides?: Partial<Pick<SecuritySettings, 'biometricEnabled' | 'lockTimeoutMs'>>): Promise<SecuritySettings> {
  const salt = generateSalt();
  const pinHash = await hashPin(pin, salt);
  return {
    pinHash,
    pinSalt: salt,
    biometricEnabled: overrides?.biometricEnabled ?? false,
    lockTimeoutMs: overrides?.lockTimeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS,
    updatedAt: Date.now(),
  };
}

export function isValidPinFormat(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

export function wipeAllAppData(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(DATA_KEY_PREFIX)) keys.push(key);
    }
    keys.forEach(key => localStorage.removeItem(key));
  } catch {
    // ignore
  }
}

export { DEFAULT_LOCK_TIMEOUT_MS, SECURITY_STORAGE_KEY };
