const SECURITY_STORAGE_KEY = 'financial-clarity:security';
const DATA_KEY_PREFIX = 'financial-clarity:';
const DEFAULT_LOCK_TIMEOUT_MS = 30_000;
const ATTEMPTS_PER_COOLDOWN = 5;
/** Cooldown after the 1st, 2nd, 3rd, and later rounds of failed attempts. */
const COOLDOWN_STEPS_MS = [30_000, 60_000, 5 * 60_000, 15 * 60_000] as const;

export interface SecuritySettings {
  pinHash: string;
  pinSalt: string;
  biometricEnabled: boolean;
  lockTimeoutMs: number;
  updatedAt: number;
  /** Consecutive failed unlock attempts; kept across restarts. Absent means 0. */
  failedAttempts?: number;
  /** Epoch ms until which PIN entry is refused. Absent means no cooldown. */
  cooldownUntil?: number;
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
    return isValidSettings(parsed) ? withValidLockout(parsed) : null;
  } catch {
    return null;
  }
}

// A damaged attempt counter must never disable the lock, so invalid optional
// lockout fields are dropped instead of rejecting the whole settings object.
function withValidLockout(settings: SecuritySettings): SecuritySettings {
  const { failedAttempts, cooldownUntil, ...rest } = settings;
  const next: SecuritySettings = { ...rest };
  if (typeof failedAttempts === 'number' && Number.isInteger(failedAttempts) && failedAttempts > 0) {
    next.failedAttempts = failedAttempts;
  }
  if (typeof cooldownUntil === 'number' && Number.isFinite(cooldownUntil) && cooldownUntil > 0) {
    next.cooldownUntil = cooldownUntil;
  }
  return next;
}

export function isInCooldown(settings: SecuritySettings, now: number): boolean {
  return (settings.cooldownUntil ?? 0) > now;
}

/**
 * Records one failed unlock. Every fifth consecutive failure starts a cooldown
 * that grows 30 s → 1 min → 5 min → 15 min, then stays at 15 min.
 */
export function withFailedAttempt(settings: SecuritySettings, now: number): SecuritySettings {
  const failedAttempts = (settings.failedAttempts ?? 0) + 1;
  if (failedAttempts % ATTEMPTS_PER_COOLDOWN !== 0) {
    return { ...settings, failedAttempts };
  }
  const round = failedAttempts / ATTEMPTS_PER_COOLDOWN;
  const step = COOLDOWN_STEPS_MS[Math.min(round, COOLDOWN_STEPS_MS.length) - 1];
  return { ...settings, failedAttempts, cooldownUntil: now + step };
}

export function withoutFailedAttempts(settings: SecuritySettings): SecuritySettings {
  const { failedAttempts: _attempts, cooldownUntil: _cooldown, ...rest } = settings;
  return rest;
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

export { ATTEMPTS_PER_COOLDOWN, COOLDOWN_STEPS_MS, DEFAULT_LOCK_TIMEOUT_MS, SECURITY_STORAGE_KEY };
