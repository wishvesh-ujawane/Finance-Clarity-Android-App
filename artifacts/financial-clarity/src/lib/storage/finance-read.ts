/**
 * Reads finance data from storage (ARCHITECTURE §6.1, DATABASE §6.1).
 * Anything that fails its validator is quarantined: the original raw text is
 * copied to `financial-clarity:backup:<key>:<epoch_ms>` before the valid part
 * is returned, so nothing is dropped silently.
 */
import type { Budget, Category, MonthReconciliation, RecurringExpense, SavingsGoal, Transaction } from '@/lib/types';
import { FINANCE_STORAGE_KEYS, type FinanceStorageKey } from './finance-storage';
import { quarantineKey, quarantineKeyPrefix } from './keys';
import {
  isObject,
  isValidBudget,
  isValidCategory,
  isValidReconciliation,
  isValidRecurring,
  isValidSavingsGoalEntry,
  isValidTransaction,
} from './schemas';

export interface StoredFinanceData {
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  recurringExpenses: RecurringExpense[];
  reconciliations: MonthReconciliation[];
  /** `null` when nothing usable is stored. */
  savingsGoal: SavingsGoal | null;
}

export interface QuarantineReport {
  key: FinanceStorageKey;
  /** Records that failed validation, or `null` when the whole key was unreadable. */
  invalidCount: number | null;
  /** `false` when the raw copy could not be saved, so the original must not be overwritten. */
  preserved: boolean;
}

export type FinanceReadResult =
  | { ok: true; data: StoredFinanceData; quarantined: QuarantineReport[] }
  | { ok: false; error: 'unavailable' };

export interface FinanceReadOptions {
  /** Copy invalid raw data to quarantine keys. Off for read-only callers such as backup. */
  quarantine?: boolean;
}

type SavingsGoalEntry = SavingsGoal['goal'];

const EMPTY_ENTRY: SavingsGoalEntry = { monthly: 0, annual: 0 };

function pickEntry(entry: SavingsGoalEntry): SavingsGoalEntry {
  const out: SavingsGoalEntry = { monthly: entry.monthly, annual: entry.annual };
  if (entry.createdAt) out.createdAt = entry.createdAt;
  return out;
}

/** Saves `raw` unless an identical quarantine copy of `key` already exists. */
function preserveRaw(key: string, raw: string): boolean {
  try {
    const prefix = quarantineKeyPrefix(key);
    for (let i = 0; i < localStorage.length; i++) {
      const existing = localStorage.key(i);
      if (existing?.startsWith(prefix) && localStorage.getItem(existing) === raw) return true;
    }
    localStorage.setItem(quarantineKey(key, Date.now()), raw);
    return true;
  } catch {
    return false;
  }
}

export function readFinanceData(options: FinanceReadOptions = {}): FinanceReadResult {
  const shouldQuarantine = options.quarantine ?? true;
  const quarantined: QuarantineReport[] = [];

  const report = (name: FinanceStorageKey, raw: string, invalidCount: number | null) => {
    const preserved = shouldQuarantine ? preserveRaw(FINANCE_STORAGE_KEYS[name], raw) : true;
    quarantined.push({ key: name, invalidCount, preserved });
  };

  const parse = (raw: string): { ok: true; value: unknown } | { ok: false } => {
    try {
      return { ok: true, value: JSON.parse(raw) as unknown };
    } catch {
      return { ok: false };
    }
  };

  const readArray = <T,>(name: FinanceStorageKey, isValid: (value: unknown) => value is T): T[] => {
    const raw = localStorage.getItem(FINANCE_STORAGE_KEYS[name]);
    if (!raw) return [];
    const parsed = parse(raw);
    if (!parsed.ok || !Array.isArray(parsed.value)) {
      report(name, raw, null);
      return [];
    }
    const valid = parsed.value.filter(isValid);
    if (valid.length !== parsed.value.length) report(name, raw, parsed.value.length - valid.length);
    return valid;
  };

  const readSavingsGoal = (): SavingsGoal | null => {
    const raw = localStorage.getItem(FINANCE_STORAGE_KEYS.savingsGoal);
    if (!raw) return null;
    const parsed = parse(raw);
    const value = parsed.ok ? parsed.value : undefined;
    if (!isObject(value)) {
      report('savingsGoal', raw, null);
      return null;
    }
    if ('goal' in value || 'emergency' in value) {
      let invalid = 0;
      const bucket = (entry: unknown): SavingsGoalEntry => {
        if (entry === undefined) return { ...EMPTY_ENTRY };
        if (isValidSavingsGoalEntry(entry)) return pickEntry(entry);
        invalid += 1;
        return { ...EMPTY_ENTRY };
      };
      const goal = { goal: bucket(value.goal), emergency: bucket(value.emergency) };
      if (invalid > 0) report('savingsGoal', raw, invalid);
      return goal;
    }
    // Legacy single-bucket shape { monthly, annual } loads into `goal` (DATABASE §10.1).
    if (isValidSavingsGoalEntry(value)) return { goal: pickEntry(value), emergency: { ...EMPTY_ENTRY } };
    report('savingsGoal', raw, null);
    return null;
  };

  try {
    const data: StoredFinanceData = {
      transactions: readArray('transactions', isValidTransaction),
      categories: readArray('categories', isValidCategory),
      budgets: readArray('budgets', isValidBudget),
      recurringExpenses: readArray('recurring', isValidRecurring),
      reconciliations: readArray('reconciliations', isValidReconciliation),
      savingsGoal: readSavingsGoal(),
    };
    return { ok: true, data, quarantined };
  } catch {
    return { ok: false, error: 'unavailable' };
  }
}
