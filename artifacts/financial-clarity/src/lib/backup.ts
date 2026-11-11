import { Capacitor } from '@capacitor/core';
import type {
  Budget,
  Category,
  RecurringExpense,
  SavingsGoal,
  Transaction,
} from './types';
import { sha256Hex } from './backupHash';
import { readFinanceData } from './storage/finance-read';
import { writeStorageEntries, type StorageWriteResult } from './storage/finance-storage';
import { STORAGE_KEYS } from './storage/keys';
import {
  isObject as isObj,
  isValidBudget,
  isValidCategory,
  isValidRecurring,
  isValidSavingsGoal,
  isValidTransaction,
} from './storage/schemas';

export const BACKUP_VERSION = 4;

export interface BackupCounts {
  transactions: number;
  categories: number;
  budgets: number;
  recurringExpenses: number;
  savingsGoal: number; // 0 or 1
  pendingSms: number;
  dismissedSmsFingerprints: number;
  linkedSms: number;
}

export interface BackupDeviceInfo {
  platform: string;
  model?: string;
  osVersion?: string;
}

export interface BackupSmsState {
  /** Opaque legacy fields; never interpreted by the finance runtime. */
  pendingSms: unknown[];
  dismissedSmsFingerprints: string[];
  linkedSms: Record<string, unknown>;
  lastScanMs: number;
}

export interface BackupFile {
  schemaVersion: number;
  appVersion: string;
  exportedAt: string;
  device: BackupDeviceInfo;
  counts: BackupCounts;
  data: {
    transactions: Transaction[];
    categories: Category[];
    budgets: Budget[];
    recurringExpenses: RecurringExpense[];
    savingsGoal: SavingsGoal | null;
    sms: BackupSmsState;
  };
}

const STORAGE = {
  transactions: STORAGE_KEYS.transactions,
  categories: STORAGE_KEYS.categories,
  budgets: STORAGE_KEYS.budgets,
  recurring: STORAGE_KEYS.recurring,
  savingsGoal: STORAGE_KEYS.savingsGoal,
  smsPending: STORAGE_KEYS.smsPending,
  smsDismissed: STORAGE_KEYS.smsDismissed,
  smsLinked: STORAGE_KEYS.smsLinked,
  smsLastScan: STORAGE_KEYS.smsLastScan,
} as const;

const APP_VERSION = '1.0.0';

const EMPTY_SMS_STATE: BackupSmsState = {
  pendingSms: [],
  dismissedSmsFingerprints: [],
  linkedSms: {},
  lastScanMs: 0,
};

/** Migrations run before validation when restoring an older backup. */
export const migrations: Record<number, (b: BackupFile) => BackupFile> = {
  // v1 -> v2: added optional Transaction.paymentMethod field; no data transform needed.
  1: (b) => ({ ...b, schemaVersion: 2 }),
  // v2 -> v3: added a legacy data block. Keep its shape for old-backup
  // compatibility; it is not read by the finance runtime.
  2: (b) => ({
    ...b,
    schemaVersion: 3,
    data: {
      ...b.data,
      sms: EMPTY_SMS_STATE,
    },
    counts: {
      ...b.counts,
      pendingSms: 0,
      dismissedSmsFingerprints: 0,
      linkedSms: 0,
    },
  }),
  // v3 -> v4: transactions may carry a stable recurring rule/month identity.
  3: (b) => ({ ...b, schemaVersion: 4 }),
};

// ---------------- Validators ----------------
// Entity validators are shared with storage reads (lib/storage/schemas.ts).
function isValidSmsState(value: unknown): value is BackupSmsState {
  if (!isObj(value)) return false;
  if (!Array.isArray(value.pendingSms)) return false;
  if (!Array.isArray(value.dismissedSmsFingerprints) ||
      !value.dismissedSmsFingerprints.every(v => typeof v === 'string')) return false;
  if (!isObj(value.linkedSms)) return false;
  if (typeof value.lastScanMs !== 'number' || !Number.isFinite(value.lastScanMs)) return false;
  return true;
}

// ---------------- Helpers ----------------
function parseStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function readSmsState(): BackupSmsState {
  const pending = parseStored<unknown>(STORAGE.smsPending, []);
  const dismissed = parseStored<unknown>(STORAGE.smsDismissed, []);
  const linked = parseStored<unknown>(STORAGE.smsLinked, {});
  const lastScan = parseStored<unknown>(STORAGE.smsLastScan, 0);

  return {
    pendingSms: Array.isArray(pending) ? pending : [],
    dismissedSmsFingerprints: Array.isArray(dismissed)
      ? dismissed.filter((v): v is string => typeof v === 'string')
      : [],
    linkedSms: isObj(linked) ? linked : {},
    lastScanMs: typeof lastScan === 'number' && Number.isFinite(lastScan) ? lastScan : 0,
  };
}

function getDeviceInfo(): BackupDeviceInfo {
  if (typeof window === 'undefined') return { platform: 'unknown' };
  const platform = Capacitor.getPlatform();
  return {
    platform,
    model: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 120) : undefined,
    osVersion: typeof navigator !== 'undefined' ? navigator.platform : undefined,
  };
}

// ---------------- Build ----------------
export const BACKUP_READ_FAILED_MESSAGE =
  'Couldn\u2019t read your data on this phone, so no backup was made. Close and reopen the app, then try again.';

/** Throws when local storage can't be read, so an empty backup is never produced. */
export function buildBackup(): BackupFile {
  const read = readFinanceData({ quarantine: false });
  if (!read.ok) throw new Error(BACKUP_READ_FAILED_MESSAGE);
  const { transactions, categories, budgets, recurringExpenses, savingsGoal } = read.data;
  const sms = readSmsState();

  return {
    schemaVersion: BACKUP_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    device: getDeviceInfo(),
    counts: {
      transactions: transactions.length,
      categories: categories.length,
      budgets: budgets.length,
      recurringExpenses: recurringExpenses.length,
      savingsGoal: savingsGoal ? 1 : 0,
      pendingSms: sms.pendingSms.length,
      dismissedSmsFingerprints: sms.dismissedSmsFingerprints.length,
      linkedSms: Object.keys(sms.linkedSms).length,
    },
    data: { transactions, categories, budgets, recurringExpenses, savingsGoal, sms },
  };
}

export function serializeBackup(backup: BackupFile): string {
  return JSON.stringify(backup);
}

export function parseBackup(raw: string): unknown {
  return JSON.parse(raw);
}

// ---------------- Validate ----------------
export type ValidationResult =
  | { ok: true; backup: BackupFile }
  | { ok: false; reason: 'invalid-shape' | 'newer-version' | 'migration-failed' | 'invalid-data'; errors: string[] };

export function validateBackup(value: unknown): ValidationResult {
  if (!isObj(value)) return { ok: false, reason: 'invalid-shape', errors: ['Not an object'] };
  if (typeof value.schemaVersion !== 'number') {
    return { ok: false, reason: 'invalid-shape', errors: ['Missing schemaVersion'] };
  }
  if (value.schemaVersion > BACKUP_VERSION) {
    return { ok: false, reason: 'newer-version', errors: [
      `Backup schemaVersion ${value.schemaVersion} is newer than supported (${BACKUP_VERSION}). Update the app.`,
    ] };
  }

  // Apply migrations.
  let migrated = value as unknown as BackupFile;
  try {
    while (migrated.schemaVersion < BACKUP_VERSION) {
      const migrate = migrations[migrated.schemaVersion];
      if (!migrate) {
        return { ok: false, reason: 'migration-failed', errors: [
          `No migration from v${migrated.schemaVersion} to v${migrated.schemaVersion + 1}`,
        ] };
      }
      migrated = migrate(migrated);
    }
  } catch (err) {
    return { ok: false, reason: 'migration-failed', errors: [
      err instanceof Error ? err.message : 'Migration error',
    ] };
  }

  // Shape check.
  if (!isObj(migrated.data)) {
    return { ok: false, reason: 'invalid-shape', errors: ['Missing data block'] };
  }
  const errors: string[] = [];
  const data = migrated.data as Record<string, unknown>;
  if (!Array.isArray(data.transactions)) errors.push('transactions must be an array');
  if (!Array.isArray(data.categories)) errors.push('categories must be an array');
  if (!Array.isArray(data.budgets)) errors.push('budgets must be an array');
  if (!Array.isArray(data.recurringExpenses)) errors.push('recurringExpenses must be an array');
  if (!isValidSmsState(data.sms)) errors.push('sms block is invalid or missing');
  if (errors.length > 0) return { ok: false, reason: 'invalid-shape', errors };

  // Per-record validation.
  const txOk = (data.transactions as unknown[]).every(isValidTransaction);
  const catOk = (data.categories as unknown[]).every(isValidCategory);
  const budgetOk = (data.budgets as unknown[]).every(isValidBudget);
  const recurOk = (data.recurringExpenses as unknown[]).every(isValidRecurring);
  const savingsOk =
    data.savingsGoal === null ||
    data.savingsGoal === undefined ||
    isValidSavingsGoal(data.savingsGoal);

  if (!txOk) errors.push('One or more transactions are invalid');
  if (!catOk) errors.push('One or more categories are invalid');
  if (!budgetOk) errors.push('One or more budgets are invalid');
  if (!recurOk) errors.push('One or more recurring expenses are invalid');
  if (!savingsOk) errors.push('Savings goal is invalid');

  if (errors.length > 0) return { ok: false, reason: 'invalid-data', errors };

  return { ok: true, backup: migrated };
}

// ---------------- Apply (atomic) ----------------
export type ApplyResult =
  | { ok: true; counts: BackupCounts }
  | Extract<StorageWriteResult, { ok: false }>;

/**
 * Atomic restore (DATABASE §7.3): every key is written together and rolled
 * back together if any write fails. The caller then calls `reloadFromStorage()`.
 */
export function applyBackup(backup: BackupFile): ApplyResult {
  const entries: Array<[string, unknown]> = [
    [STORAGE.transactions, backup.data.transactions],
    [STORAGE.categories, backup.data.categories],
    [STORAGE.budgets, backup.data.budgets],
    [STORAGE.recurring, backup.data.recurringExpenses],
  ];
  // Legacy SMS keys are only written when the backup carries data for them.
  if (backup.data.sms.pendingSms.length > 0) {
    entries.push([STORAGE.smsPending, backup.data.sms.pendingSms]);
  }
  if (backup.data.sms.dismissedSmsFingerprints.length > 0) {
    entries.push([STORAGE.smsDismissed, backup.data.sms.dismissedSmsFingerprints]);
  }
  if (Object.keys(backup.data.sms.linkedSms).length > 0) {
    entries.push([STORAGE.smsLinked, backup.data.sms.linkedSms]);
  }
  if (backup.data.sms.lastScanMs !== 0) {
    entries.push([STORAGE.smsLastScan, backup.data.sms.lastScanMs]);
  }
  entries.push([STORAGE.savingsGoal, backup.data.savingsGoal ?? undefined]);

  const result = writeStorageEntries(entries);
  return result.ok ? { ok: true, counts: backup.counts } : result;
}

/** A stable hash of the data block (ignoring exportedAt) — used to skip auto-backup when nothing changed. */
export async function hashBackupData(backup: BackupFile): Promise<string> {
  const stable = JSON.stringify(backup.data);
  return sha256Hex(stable);
}
