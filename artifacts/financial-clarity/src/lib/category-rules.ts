import {
  SAVINGS_CATEGORY_IDS,
  SYSTEM_ADJUSTMENT_CATEGORY_IDS,
  type Budget,
  type Category,
  type RecurringExpense,
  type Transaction,
} from '@/lib/types';

const RESERVED_CATEGORY_IDS: ReadonlySet<string> = new Set([
  ...SAVINGS_CATEGORY_IDS,
  ...SYSTEM_ADJUSTMENT_CATEGORY_IDS,
]);

/**
 * Categories that must stay usable for their features, so they can never be
 * made inactive (DATABASE §6.2, owner-approved): the reserved categories plus
 * the "Other" fallbacks used by CSV import.
 */
const ALWAYS_ACTIVE_CATEGORY_IDS: ReadonlySet<string> = new Set([
  ...RESERVED_CATEGORY_IDS,
  'other',
  'other-income',
]);

export const INACTIVE_CATEGORY_MESSAGE =
  'This category is inactive. Choose another category, or reactivate it in Settings \u2192 Categories. Nothing was saved.';

/** An absent `active` value (data saved before local migration 1) means active. */
export function isCategoryActive(category: Pick<Category, 'active'>): boolean {
  return category.active !== false;
}

/**
 * Active category names are unique, ignoring case and surrounding spaces
 * (DATABASE §6.2). `exceptId` skips the category being edited.
 */
export function findActiveNameClash<T extends Pick<Category, 'id' | 'name' | 'active'>>(
  categories: readonly T[],
  name: string,
  exceptId?: string,
): T | undefined {
  const wanted = name.trim().toLocaleLowerCase('en-IN');
  return categories.find(
    c => c.id !== exceptId && isCategoryActive(c) && c.name.trim().toLocaleLowerCase('en-IN') === wanted,
  );
}

export function duplicateNameMessage(name: string): string {
  return `An active category called \u201c${name.trim()}\u201d already exists. Use a different name. Nothing was saved.`;
}

export function canDeactivateCategory(categoryId: string): boolean {
  return !ALWAYS_ACTIVE_CATEGORY_IDS.has(categoryId);
}

/**
 * Categories offered for a new entry: active ones only. When editing, the
 * entry's current category stays available even if it is inactive.
 */
export function selectableCategories<T extends Pick<Category, 'id' | 'active'>>(
  categories: readonly T[],
  currentCategoryId?: string,
): T[] {
  return categories.filter(c => isCategoryActive(c) || c.id === currentCategoryId);
}

export interface CategoryUsage {
  transactions: number;
  budgets: number;
  recurring: number;
}

export interface CategoryReferences {
  transactions: Transaction[];
  budgets: Budget[];
  recurringExpenses: RecurringExpense[];
}

export type CategoryDeleteCheck =
  | { ok: true }
  | { ok: false; reason: 'reserved' }
  | { ok: false; reason: 'in-use'; usage: CategoryUsage };

/** Savings and month-end adjustment categories are built in and never deleted. */
export function isReservedCategory(categoryId: string): boolean {
  return RESERVED_CATEGORY_IDS.has(categoryId);
}

export function getCategoryUsage(categoryId: string, refs: CategoryReferences): CategoryUsage {
  return {
    transactions: refs.transactions.filter(t => t.categoryId === categoryId).length,
    budgets: refs.budgets.filter(b => b.categoryId === categoryId).length,
    recurring: refs.recurringExpenses.filter(r => r.categoryId === categoryId).length,
  };
}

/**
 * A category can be deleted only when it is not reserved and nothing refers
 * to it (PRD FR-03, D6). Dependent records are never deleted with it.
 */
export function canDeleteCategory(categoryId: string, refs: CategoryReferences): CategoryDeleteCheck {
  if (isReservedCategory(categoryId)) return { ok: false, reason: 'reserved' };
  const usage = getCategoryUsage(categoryId, refs);
  if (usage.transactions > 0 || usage.budgets > 0 || usage.recurring > 0) {
    return { ok: false, reason: 'in-use', usage };
  }
  return { ok: true };
}

export function describeCategoryDeleteBlock(check: Exclude<CategoryDeleteCheck, { ok: true }>): string {
  if (check.reason === 'reserved') return 'This is a built-in category, so it can\u2019t be deleted.';
  const parts: string[] = [];
  const { transactions, budgets, recurring } = check.usage;
  if (transactions > 0) parts.push(`${transactions} transaction${transactions === 1 ? '' : 's'}`);
  if (budgets > 0) parts.push(`${budgets} budget${budgets === 1 ? '' : 's'}`);
  if (recurring > 0) parts.push(`${recurring} recurring expense${recurring === 1 ? '' : 's'}`);
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
  return `Used by ${list}, so it can\u2019t be deleted.`;
}
