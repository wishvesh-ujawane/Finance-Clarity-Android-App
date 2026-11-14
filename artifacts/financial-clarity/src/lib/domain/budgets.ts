/**
 * Budget rules (PRD FR-05). The monthly summary groups budgets by type.
 * Copying sets limits in the target month (PRD §6 "Budget copying"); it never
 * moves money and never touches spending.
 */
import type { Budget, Category } from '@/lib/types';
import {
  categorySpent,
  isConsumptionExpense,
  isSavingsContribution,
  type MetricTransaction,
} from './finance-metrics';
import { isInMonth } from './periods';

export type BudgetBucketKey = 'dayToDay' | 'commitments' | 'savings';

export interface BudgetBucket {
  /** Sum of the limits set in this bucket for the month. */
  limit: number;
  /** Amount counted against those limits (same rule as each budget card). */
  spent: number;
  /** Amount in this bucket's categories that have no budget this month. */
  unbudgeted: number;
  /** Number of budgets in this bucket. */
  count: number;
}

export type BudgetSummary = Record<BudgetBucketKey, BudgetBucket>;

function bucketFor(category: Pick<Category, 'type'> | undefined): BudgetBucketKey {
  if (category?.type === 'commitment') return 'commitments';
  if (category?.type === 'savings') return 'savings';
  return 'dayToDay';
}

/**
 * One month's budgets split into day-to-day, commitments, and savings. The
 * Budgets screen and Analysis both read this, so they always show the same
 * numbers. For each bucket, `spent + unbudgeted` equals that bucket's total
 * for the month (day-to-day, commitments, or savings contributions).
 */
export function budgetSummary(
  transactions: readonly MetricTransaction[],
  categories: ReadonlyArray<Pick<Category, 'id' | 'type'>>,
  budgets: readonly Budget[],
  month: string,
): BudgetSummary {
  const empty = (): BudgetBucket => ({ limit: 0, spent: 0, unbudgeted: 0, count: 0 });
  const summary: BudgetSummary = { dayToDay: empty(), commitments: empty(), savings: empty() };
  const categoryById = new Map(categories.map(c => [c.id, c] as const));
  const budgeted = new Set<string>();

  for (const b of budgets) {
    if (b.month !== month) continue;
    const bucket = summary[bucketFor(categoryById.get(b.categoryId))];
    bucket.limit += b.limit;
    bucket.count += 1;
    if (budgeted.has(b.categoryId)) continue;
    budgeted.add(b.categoryId);
    bucket.spent += categorySpent(transactions, b.categoryId, month);
  }

  for (const tx of transactions) {
    if (!isInMonth(tx.date, month) || budgeted.has(tx.categoryId)) continue;
    if (isSavingsContribution(tx)) summary.savings.unbudgeted += tx.amount;
    else if (isConsumptionExpense(tx)) {
      const key = bucketFor(categoryById.get(tx.categoryId));
      summary[key === 'savings' ? 'dayToDay' : key].unbudgeted += tx.amount;
    }
  }
  return summary;
}

export interface BudgetCopyPlan {
  /** Source limits that create a new budget in the target month. */
  created: Array<{ categoryId: string; limit: number }>;
  /** Target budgets whose limit is replaced by the source limit. */
  overwritten: Array<{ budgetId: string; categoryId: string; previousLimit: number; limit: number }>;
  /** Target budgets that already have the same limit. */
  unchanged: number;
  /** Target budgets for categories not in the source month; they are kept. */
  keptInTarget: number;
  /** Source categories that are inactive and have no target budget, so nothing is created. */
  skippedInactive: string[];
}

export function planBudgetCopy(
  budgets: readonly Budget[],
  categories: ReadonlyArray<Pick<Category, 'id' | 'active'>>,
  fromMonth: string,
  toMonth: string,
): BudgetCopyPlan {
  const plan: BudgetCopyPlan = { created: [], overwritten: [], unchanged: 0, keptInTarget: 0, skippedInactive: [] };
  if (fromMonth === toMonth) return plan;
  const source = budgets.filter(b => b.month === fromMonth);
  const target = budgets.filter(b => b.month === toMonth);
  const sourceIds = new Set(source.map(b => b.categoryId));
  const categoryById = new Map(categories.map(c => [c.id, c] as const));

  for (const s of source) {
    const existing = target.find(t => t.categoryId === s.categoryId);
    if (existing) {
      if (existing.limit === s.limit) plan.unchanged += 1;
      else plan.overwritten.push({ budgetId: existing.id, categoryId: s.categoryId, previousLimit: existing.limit, limit: s.limit });
      continue;
    }
    const category = categoryById.get(s.categoryId);
    if (category && category.active === false) {
      plan.skippedInactive.push(s.categoryId);
      continue;
    }
    plan.created.push({ categoryId: s.categoryId, limit: s.limit });
  }
  plan.keptInTarget = target.filter(t => !sourceIds.has(t.categoryId)).length;
  return plan;
}

/** The budgets after applying `plan`; `newId` supplies IDs for created budgets. */
export function applyBudgetCopy(budgets: readonly Budget[], plan: BudgetCopyPlan, toMonth: string, newId: () => string): Budget[] {
  const limits = new Map(plan.overwritten.map(o => [o.budgetId, o.limit] as const));
  return [
    ...budgets.map(b => (limits.has(b.id) ? { ...b, limit: limits.get(b.id) as number } : b)),
    ...plan.created.map(c => ({ id: newId(), categoryId: c.categoryId, limit: c.limit, month: toMonth })),
  ];
}

export function budgetCopyCount(plan: BudgetCopyPlan): number {
  return plan.created.length + plan.overwritten.length + plan.unchanged;
}
