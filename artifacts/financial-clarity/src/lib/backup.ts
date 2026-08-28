import { Capacitor } from '@capacitor/core';
import type {
  Budget,
  Category,
  RecurringExpense,
  SavingsGoal,
  Transaction,
} from './types';
import type { ParsedSms } from './sms/parser/types';
import { sha256Hex } from './backupHash';

export const BACKUP_VERSION = 3;

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
  pendingSms: ParsedSms[];
  dismissedSmsFingerprints: string[];
  linkedSms: Record<string, ParsedSms>;
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
  transactions: 'financial-clarity:transactions',
  categories: 'financial-clarity:categories',
  budgets: 'financial-clarity:budgets',
  recurring: 'financial-clarity:recurring',
  savingsGoal: 'financial-clarity:savings-goal',
  smsPending: 'financial-clarity:sms-pending',
  smsDismissed: 'financial-clarity:sms-dismissed',
  smsLinked: 'financial-clarity:sms-linked',
  smsLastScan: 'financial-clarity:sms-last-scan',
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
  // v2 -> v3: added SMS auto-import state (pendingSms, dismissedSmsFingerprints,
  // linkedSms, lastScanMs). Older backups get an empty SMS block so restore
  // is safe and idempotent.
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
};

// ---------------- Validators ----------------
function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

const VALID_PAYMENT_METHODS = new Set(['cash', 'bank', 'credit-card', 'credit-card-payment']);

function isValidTransaction(value: unknown): value is Transaction {
  return (
    isObj(value) &&
    typeof value.id === 'string' && value.id.length > 0 &&
    (value.type === 'income' || value.type === 'expense') &&
    typeof value.amount === 'number' && Number.isFinite(value.amount) &&
    typeof value.categoryId === 'string' && value.categoryId.length > 0 &&
    (value.note === undefined || typeof value.note === 'string') &&
    typeof value.date === 'string' && value.date.length > 0 &&
    (value.paymentMethod === undefined ||
      (typeof value.paymentMethod === 'string' && VALID_PAYMENT_METHODS.has(value.paymentMethod))) &&
    (value.sourceSmsFingerprint === undefined || typeof value.sourceSmsFingerprint === 'string') &&
    (value.merchant === undefined || typeof value.merchant === 'string')
  );
}

function isValidCategory(value: unknown): value is Category {
  return (
    isObj(value) &&
    typeof value.id === 'string' && value.id.length > 0 &&
    typeof value.name === 'string' && value.name.length > 0 &&
    typeof value.icon === 'string' &&
    typeof value.color === 'string' &&
    (value.type === 'income' || value.type === 'expense' ||
      value.type === 'commitment' || value.type === 'savings' || value.type === 'both')
  );
}

function isValidBudget(value: unknown): value is Budget {
  return (
    isObj(value) &&
    typeof value.id === 'string' && value.id.length > 0 &&
    typeof value.categoryId === 'string' && value.categoryId.length > 0 &&
    typeof value.limit === 'number' && Number.isFinite(value.limit) &&
    (value.month === undefined || typeof value.month === 'string')
  );
}

function isValidRecurring(value: unknown): value is RecurringExpense {
  return (
    isObj(value) &&
    typeof value.id === 'string' && value.id.length > 0 &&
    typeof value.description === 'string' &&
    typeof value.amount === 'number' && Number.isFinite(value.amount) &&
    typeof value.categoryId === 'string' && value.categoryId.length > 0 &&
    typeof value.dayOfMonth === 'number' &&
    value.dayOfMonth >= 1 && value.dayOfMonth <= 31 &&
    typeof value.active === 'boolean' &&
    typeof value.startMonth === 'string' &&
    (value.lastGeneratedMonth === undefined || typeof value.lastGeneratedMonth === 'string')
  );
}

function isValidSavingsGoal(value: unknown): value is SavingsGoal {
  const validEntry = (v: unknown) =>
    isObj(v) &&
    typeof v.monthly === 'number' && Number.isFinite(v.monthly) &&
    typeof v.annual === 'number' && Number.isFinite(v.annual);
  return isObj(value) && validEntry(value.goal) && validEntry(value.emergency);
}

const VALID_SMS_PAYMENT_METHODS = new Set(['bank', 'credit-card', 'credit-card-payment']);
const VALID_SMS_DIRECTIONS = new Set(['debit', 'credit']);
const VALID_SMS_REASONS = new Set(['purchase', 'refund', 'salary', 'card-payment', 'transfer', 'unknown']);

function isValidParsedSms(value: unknown): value is ParsedSms {
  return (
    isObj(value) &&
    typeof value.smsId === 'string' && value.smsId.length > 0 &&
    typeof value.fingerprint === 'string' && value.fingerprint.length > 0 &&
    typeof value.senderId === 'string' &&
    typeof value.amount === 'number' && Number.isFinite(value.amount) &&
    typeof value.direction === 'string' && VALID_SMS_DIRECTIONS.has(value.direction) &&
    (value.merchant === null || typeof value.merchant === 'string') &&
    (value.accountTail === null || typeof value.accountTail === 'string') &&
    typeof value.paymentMethod === 'string' && VALID_SMS_PAYMENT_METHODS.has(value.paymentMethod) &&
    (value.txnRef === null || typeof value.txnRef === 'string') &&
    typeof value.timestamp === 'number' && Number.isFinite(value.timestamp) &&
    typeof value.dateISO === 'string' && value.dateISO.length > 0 &&
    (value.suggestedCategoryId === null || typeof value.suggestedCategoryId === 'string') &&
    typeof value.reason === 'string' && VALID_SMS_REASONS.has(value.reason) &&
    typeof value.rawBody === 'string'
  );
}

function isValidSmsState(value: unknown): value is BackupSmsState {
  if (!isObj(value)) return false;
  if (!Array.isArray(value.pendingSms) || !value.pendingSms.every(isValidParsedSms)) return false;
  if (!Array.isArray(value.dismissedSmsFingerprints) ||
      !value.dismissedSmsFingerprints.every(v => typeof v === 'string')) return false;
  if (!isObj(value.linkedSms)) return false;
  for (const v of Object.values(value.linkedSms)) {
    if (!isValidParsedSms(v)) return false;
  }
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

function readArray<T>(key: string, isValid: (v: unknown) => v is T): T[] {
  const parsed = parseStored<unknown>(key, []);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isValid);
}

function readSavingsGoal(): SavingsGoal | null {
  const parsed = parseStored<unknown>(STORAGE.savingsGoal, null);
  if (parsed === null) return null;
  return isValidSavingsGoal(parsed) ? parsed : null;
}

function readSmsState(): BackupSmsState {
  const pending = parseStored<unknown>(STORAGE.smsPending, []);
  const dismissed = parseStored<unknown>(STORAGE.smsDismissed, []);
  const linked = parseStored<unknown>(STORAGE.smsLinked, {});
  const lastScan = parseStored<unknown>(STORAGE.smsLastScan, 0);

  return {
    pendingSms: Array.isArray(pending) ? pending.filter(isValidParsedSms) : [],
    dismissedSmsFingerprints: Array.isArray(dismissed)
      ? dismissed.filter((v): v is string => typeof v === 'string')
      : [],
    linkedSms: isObj(linked)
      ? Object.fromEntries(
          Object.entries(linked).filter(([, v]) => isValidParsedSms(v)),
        ) as Record<string, ParsedSms>
      : {},
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
export function buildBackup(): BackupFile {
  const transactions = readArray(STORAGE.transactions, isValidTransaction);
  const categories = readArray(STORAGE.categories, isValidCategory);
  const budgets = readArray(STORAGE.budgets, isValidBudget);
  const recurringExpenses = readArray(STORAGE.recurring, isValidRecurring);
  const savingsGoal = readSavingsGoal();
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
export interface ApplyResult {
  counts: BackupCounts;
}

/**
 * Atomic restore: snapshot current localStorage values first; write new values;
 * on any failure, roll back. Triggers `storage` events so the FinanceContext
 * `reloadFromStorage()` listener picks up the change.
 */
export function applyBackup(backup: BackupFile): ApplyResult {
  const snapshot: Partial<Record<keyof typeof STORAGE, string | null>> = {
    transactions: localStorage.getItem(STORAGE.transactions),
    categories: localStorage.getItem(STORAGE.categories),
    budgets: localStorage.getItem(STORAGE.budgets),
    recurring: localStorage.getItem(STORAGE.recurring),
    savingsGoal: localStorage.getItem(STORAGE.savingsGoal),
    smsPending: localStorage.getItem(STORAGE.smsPending),
    smsDismissed: localStorage.getItem(STORAGE.smsDismissed),
    smsLinked: localStorage.getItem(STORAGE.smsLinked),
    smsLastScan: localStorage.getItem(STORAGE.smsLastScan),
  };

  const writes: Array<[string, string]> = [
    [STORAGE.transactions, JSON.stringify(backup.data.transactions)],
    [STORAGE.categories, JSON.stringify(backup.data.categories)],
    [STORAGE.budgets, JSON.stringify(backup.data.budgets)],
    [STORAGE.recurring, JSON.stringify(backup.data.recurringExpenses)],
    [STORAGE.smsPending, JSON.stringify(backup.data.sms.pendingSms)],
    [STORAGE.smsDismissed, JSON.stringify(backup.data.sms.dismissedSmsFingerprints)],
    [STORAGE.smsLinked, JSON.stringify(backup.data.sms.linkedSms)],
    [STORAGE.smsLastScan, JSON.stringify(backup.data.sms.lastScanMs)],
  ];

  try {
    for (const [k, v] of writes) localStorage.setItem(k, v);
    if (backup.data.savingsGoal) {
      localStorage.setItem(STORAGE.savingsGoal, JSON.stringify(backup.data.savingsGoal));
    } else {
      localStorage.removeItem(STORAGE.savingsGoal);
    }
  } catch (err) {
    // Roll back every key we snapshotted.
    const rollback = (key: (typeof STORAGE)[keyof typeof STORAGE], prev: string | null | undefined) => {
      if (prev !== null && prev !== undefined) localStorage.setItem(key, prev);
      else localStorage.removeItem(key);
    };
    rollback(STORAGE.transactions, snapshot.transactions);
    rollback(STORAGE.categories, snapshot.categories);
    rollback(STORAGE.budgets, snapshot.budgets);
    rollback(STORAGE.recurring, snapshot.recurring);
    rollback(STORAGE.savingsGoal, snapshot.savingsGoal);
    rollback(STORAGE.smsPending, snapshot.smsPending);
    rollback(STORAGE.smsDismissed, snapshot.smsDismissed);
    rollback(STORAGE.smsLinked, snapshot.smsLinked);
    rollback(STORAGE.smsLastScan, snapshot.smsLastScan);
    throw err;
  }

  return { counts: backup.counts };
}

/** A stable hash of the data block (ignoring exportedAt) — used to skip auto-backup when nothing changed. */
export async function hashBackupData(backup: BackupFile): Promise<string> {
  const stable = JSON.stringify(backup.data);
  return sha256Hex(stable);
}
