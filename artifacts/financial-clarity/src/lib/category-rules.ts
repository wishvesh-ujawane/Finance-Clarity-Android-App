import {
  SAVINGS_CATEGORY_IDS,
  SYSTEM_ADJUSTMENT_CATEGORY_IDS,
  type Budget,
  type RecurringExpense,
  type Transaction,
} from '@/lib/types';

const RESERVED_CATEGORY_IDS: ReadonlySet<string> = new Set([
  ...SAVINGS_CATEGORY_IDS,
  ...SYSTEM_ADJUSTMENT_CATEGORY_IDS,
]);

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
