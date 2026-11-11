/**
 * Storage boundary for finance data (ARCHITECTURE §6.2, DATABASE §7.3).
 * Writes report failures as values instead of throwing, and multi-key writes
 * roll back so a failed save leaves storage exactly as it was.
 */

export const FINANCE_STORAGE_KEYS = {
  transactions: 'financial-clarity:transactions',
  categories: 'financial-clarity:categories',
  budgets: 'financial-clarity:budgets',
  recurring: 'financial-clarity:recurring',
  reconciliations: 'financial-clarity:reconciliations',
  savingsGoal: 'financial-clarity:savings-goal',
} as const;

export type FinanceStorageKey = keyof typeof FINANCE_STORAGE_KEYS;

// Categories first so new transactions never reference a missing category;
// transactions before recurring cursors and reconciliation records (§7.3).
const FINANCE_WRITE_ORDER: FinanceStorageKey[] = [
  'categories',
  'transactions',
  'reconciliations',
  'recurring',
  'budgets',
  'savingsGoal',
];

export type StorageWriteResult =
  | { ok: true }
  | { ok: false; error: 'quota' | 'unavailable'; message: string };

export const STORAGE_FULL_MESSAGE =
  'Couldn\u2019t save because phone storage is full. Your data is unchanged. Free up space and try again.';
export const STORAGE_UNAVAILABLE_MESSAGE =
  'Couldn\u2019t save. Your data is unchanged. Close and reopen the app, then try again.';

function isQuotaError(error: unknown): boolean {
  if (!(error instanceof DOMException)) return false;
  return error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED' || error.code === 22;
}

function failure(error: unknown): StorageWriteResult {
  return isQuotaError(error)
    ? { ok: false, error: 'quota', message: STORAGE_FULL_MESSAGE }
    : { ok: false, error: 'unavailable', message: STORAGE_UNAVAILABLE_MESSAGE };
}

/**
 * Writes each `[key, value]` pair in order (`undefined` removes the key).
 * If any write fails, every key written so far is restored to its previous
 * raw value and the failure is returned.
 */
export function writeStorageEntries(entries: Array<[string, unknown]>): StorageWriteResult {
  const previous: Array<[string, string | null]> = [];
  try {
    for (const [key] of entries) previous.push([key, localStorage.getItem(key)]);
  } catch (error) {
    return failure(error);
  }

  let written = 0;
  try {
    for (const [key, value] of entries) {
      if (value === undefined) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
      written += 1;
    }
    return { ok: true };
  } catch (error) {
    for (let i = written - 1; i >= 0; i--) {
      const [key, raw] = previous[i];
      try {
        if (raw === null) localStorage.removeItem(key);
        else localStorage.setItem(key, raw);
      } catch {
        // Restoring a previous value rarely fails; keep rolling back the rest.
      }
    }
    return failure(error);
  }
}

export function writeFinanceData(changes: Partial<Record<FinanceStorageKey, unknown>>): StorageWriteResult {
  const entries: Array<[string, unknown]> = [];
  for (const key of FINANCE_WRITE_ORDER) {
    if (key in changes) entries.push([FINANCE_STORAGE_KEYS[key], changes[key]]);
  }
  return writeStorageEntries(entries);
}
