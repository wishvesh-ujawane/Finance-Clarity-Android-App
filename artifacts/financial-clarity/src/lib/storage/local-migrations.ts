/**
 * Registered local migration steps (DATABASE §10.1). Each step reads current
 * storage and returns the writes it needs; the runner saves them together
 * with the new `storage-version`. Steps must be idempotent and must never
 * drop a record silently.
 */
import { currentMonth } from '@/lib/domain/periods';
import { isObject } from './schemas';
import { RawText } from './finance-storage';
import { quarantineKey, STORAGE_KEYS } from './keys';
import type { LocalMigration } from './migrations';

function readArray(key: string): { raw: string; items: unknown[] } | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? { raw, items: parsed } : null;
  } catch {
    // Unreadable data is left for the startup read to quarantine.
    return null;
  }
}

/**
 * Gives every month-less budget `month`. When that collides with a budget for
 * the same category and month, the row that already had a month is kept and
 * the month-less row is left out (`dropped` counts them). Non-object rows are
 * kept as they are for the validators to handle.
 */
export function assignBudgetMonths(items: readonly unknown[], month: string): { items: unknown[]; changed: boolean; dropped: number } {
  const hasMonth = (item: Record<string, unknown>) => typeof item.month === 'string' && item.month !== '';
  const slot = (item: Record<string, unknown>, m: unknown) => `${String(item.categoryId)}|${String(m)}`;
  const taken = new Set(items.filter(isObject).filter(hasMonth).map(item => slot(item, item.month)));
  let changed = false;
  let dropped = 0;
  const next: unknown[] = [];
  for (const item of items) {
    if (!isObject(item) || hasMonth(item)) {
      next.push(item);
      continue;
    }
    changed = true;
    const key = slot(item, month);
    if (taken.has(key)) {
      dropped += 1;
      continue;
    }
    taken.add(key);
    next.push({ ...item, month });
  }
  return { items: next, changed, dropped };
}

/** Category `active` defaults to true where it is missing. */
export function defaultCategoriesActive(items: readonly unknown[]): { items: unknown[]; changed: boolean } {
  let changed = false;
  const next = items.map(item => {
    if (!isObject(item) || typeof item.active === 'boolean') return item;
    changed = true;
    return { ...item, active: true };
  });
  return { items: next, changed };
}

/** Migration 1: every category without an `active` value becomes active (PRD FR-03). */
export const addCategoryActiveFlag: LocalMigration = {
  version: 1,
  migrate: () => {
    const stored = readArray(STORAGE_KEYS.categories);
    if (!stored) return [];
    const result = defaultCategoriesActive(stored.items);
    return result.changed ? [[STORAGE_KEYS.categories, result.items]] : [];
  },
};

/**
 * Migration 2: every budget gets a month. A month-less budget gets the current
 * month, which is what the app already showed for it. If that collides with a
 * budget for the same category and month, the row that already had a month
 * is kept and the original data is quarantined first (DATABASE §10.1).
 */
export const requireBudgetMonth: LocalMigration = {
  version: 2,
  migrate: () => {
    const stored = readArray(STORAGE_KEYS.budgets);
    if (!stored) return [];
    const result = assignBudgetMonths(stored.items, currentMonth());
    if (!result.changed) return [];
    const writes: Array<[string, unknown]> = [];
    if (result.dropped > 0) writes.push([quarantineKey(STORAGE_KEYS.budgets, Date.now()), new RawText(stored.raw)]);
    writes.push([STORAGE_KEYS.budgets, result.items]);
    return writes;
  },
};
