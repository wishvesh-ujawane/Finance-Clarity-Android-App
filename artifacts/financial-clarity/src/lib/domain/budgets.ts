/**
 * Budget limit copying (PRD FR-05, §6 "Budget copying"). Copying sets limits
 * in the target month; it never moves money and never touches spending.
 */
import type { Budget, Category } from '@/lib/types';

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
