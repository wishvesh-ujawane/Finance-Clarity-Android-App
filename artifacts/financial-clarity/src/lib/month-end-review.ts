// Persistence + trigger helpers for the Month-End Review flow.
//
// Storage: one key per month under the existing `financial-clarity:` namespace,
// e.g. `financial-clarity:month-end-review:2026-06`, valued
// `"completed:<ts>" | "skipped:<ts>" | "dismissed:<ts>"`. Absent = pending.
//
// See docs/knowledge-base/features/month-end-review.md and
// docs/knowledge-base/decisions/0002-month-end-review-flow.md.

import { Transaction, Category, SAVINGS_CATEGORY_IDS } from '@/lib/types';
import { addMonths, currentMonth, localDateStr } from '@/lib/finance-utils';

const SAVINGS_CATEGORY_ID_SET: ReadonlySet<string> = new Set(SAVINGS_CATEGORY_IDS);

const REVIEW_KEY_PREFIX = 'financial-clarity:month-end-review:';
const MAX_LOOKBACK_MONTHS = 12;

/** Minimum single-transaction amount to be considered an impulse expense. */
export const IMPULSE_MIN_AMOUNT = 500;
/** Cap on how many impulse rows we show in the analysis card. */
export const IMPULSE_MAX_ROWS = 5;
/** Cap on how many top-category rows we show. */
export const TOP_CATEGORY_ROWS = 5;
/** Number of past months averaged when suggesting a next-month budget. */
export const BUDGET_AVG_WINDOW = 3;

export type ReviewState = 'completed' | 'skipped' | 'dismissed' | 'pending';

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function safeSet(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

function reviewKey(month: string): string {
  return `${REVIEW_KEY_PREFIX}${month}`;
}

export function getReviewState(month: string): ReviewState {
  const raw = safeGet(reviewKey(month));
  if (!raw) return 'pending';
  if (raw.startsWith('completed:')) return 'completed';
  if (raw.startsWith('skipped:')) return 'skipped';
  if (raw.startsWith('dismissed:')) return 'dismissed';
  return 'pending';
}

export function markReviewCompleted(month: string) {
  safeSet(reviewKey(month), `completed:${Date.now()}`);
}

export function markReviewSkipped(month: string) {
  safeSet(reviewKey(month), `skipped:${Date.now()}`);
}

export function markReviewDismissedForNow(month: string) {
  safeSet(reviewKey(month), `dismissed:${Date.now()}`);
}

/** Is `month` (YYYY-MM) fully in the past relative to `today`? */
export function isMonthFullyPast(month: string, today: Date = new Date()): boolean {
  const cur = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  return month < cur;
}

/** Is `today` the last calendar day of `today.getMonth()`? */
export function isLastDayOfMonth(today: Date = new Date()): boolean {
  const test = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  return test.getDate() === 1;
}

/**
 * Returns the most recent month (YYYY-MM) that is eligible for review:
 *  - fully past OR (current month AND today is last calendar day)
 *  - has at least one transaction
 *  - review state is not "completed"
 * Skipped / dismissed months are still returned so the Dashboard banner can
 * surface them. Returns null when nothing qualifies.
 */
export function getPendingReviewMonth(
  transactions: Pick<Transaction, 'date'>[],
  today: Date = new Date(),
): string | null {
  let candidate = currentMonth();
  const currentEligible = isLastDayOfMonth(today);
  if (!currentEligible) candidate = addMonths(candidate, -1);

  for (let i = 0; i < MAX_LOOKBACK_MONTHS; i++) {
    if (getReviewState(candidate) === 'completed') return null;
    const hasTxn = transactions.some(t => t.date.startsWith(candidate));
    if (hasTxn) return candidate;
    candidate = addMonths(candidate, -1);
  }
  return null;
}

/**
 * Should we auto-open the modal on app launch? True only when the pending
 * review is fresh (pending state — user hasn't skipped or dismissed yet).
 * When user has already skipped/dismissed we only show the banner and wait
 * for an explicit tap.
 */
export function shouldAutoOpenReview(
  transactions: Pick<Transaction, 'date'>[],
  today: Date = new Date(),
): { month: string; autoOpen: boolean } | null {
  const month = getPendingReviewMonth(transactions, today);
  if (!month) return null;
  const state = getReviewState(month);
  return { month, autoOpen: state === 'pending' };
}

// ─────────────────────────────────────────────────────────────
// Analysis snapshot
// ─────────────────────────────────────────────────────────────

export interface ImpulseRow {
  id: string;
  amount: number;
  note: string;
  date: string;
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
}

export interface TopCategoryRow {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  amount: number;
  pctOfSpend: number;
}

export interface ReviewSnapshot {
  month: string;
  income: number;
  expenses: number;
  savingsEmergency: number;
  savingsGoal: number;
  savingsTotal: number;
  netSaved: number;
  savingsRatePct: number;
  spendMoMChangePct: number | null;
  spendMoMLabel: string;
  topCategories: TopCategoryRow[];
  impulseExpenses: ImpulseRow[];
}

/**
 * Build the analysis snapshot for a given month. All money math flows
 * through pure sums so the caller can pass transactions from any source.
 */
export function computeReviewSnapshot(
  month: string,
  transactions: Transaction[],
  categories: Category[],
): ReviewSnapshot {
  const monthTxns = transactions.filter(t => t.date.startsWith(month));
  const prevMonth = addMonths(month, -1);
  const prevTxns = transactions.filter(t => t.date.startsWith(prevMonth));

  const catById = new Map(categories.map(c => [c.id, c] as const));

  let income = 0;
  let expenses = 0;
  let savingsEmergency = 0;
  let savingsGoal = 0;
  const bySpend: Record<string, number> = {};

  for (const t of monthTxns) {
    if (t.type === 'income') {
      income += t.amount;
      continue;
    }
    // expense typed
    if (t.categoryId === 'savings-emergency') {
      savingsEmergency += t.amount;
      continue;
    }
    if (t.categoryId === 'savings-goal') {
      savingsGoal += t.amount;
      continue;
    }
    expenses += t.amount;
    bySpend[t.categoryId] = (bySpend[t.categoryId] || 0) + t.amount;
  }

  let prevExpenses = 0;
  for (const t of prevTxns) {
    if (t.type !== 'expense') continue;
    if (SAVINGS_CATEGORY_ID_SET.has(t.categoryId)) continue;
    prevExpenses += t.amount;
  }

  const totalSpendForPct = Object.values(bySpend).reduce((s, v) => s + v, 0);
  const topCategories: TopCategoryRow[] = Object.entries(bySpend)
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_CATEGORY_ROWS)
    .map(([categoryId, amount]) => {
      const cat = catById.get(categoryId);
      return {
        categoryId,
        categoryName: cat?.name ?? 'Unknown',
        categoryIcon: cat?.icon ?? 'DollarSign',
        categoryColor: cat?.color ?? '#94A3B8',
        amount,
        pctOfSpend: totalSpendForPct > 0 ? (amount / totalSpendForPct) * 100 : 0,
      };
    });

  const impulseExpenses: ImpulseRow[] = monthTxns
    .filter(t => t.type === 'expense')
    .filter(t => !SAVINGS_CATEGORY_ID_SET.has(t.categoryId))
    .filter(t => {
      const cat = catById.get(t.categoryId);
      return cat?.type !== 'commitment';
    })
    .filter(t => t.amount >= IMPULSE_MIN_AMOUNT)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, IMPULSE_MAX_ROWS)
    .map(t => {
      const cat = catById.get(t.categoryId);
      return {
        id: t.id,
        amount: t.amount,
        note: t.note ?? '',
        date: t.date,
        categoryId: t.categoryId,
        categoryName: cat?.name ?? 'Unknown',
        categoryIcon: cat?.icon ?? 'DollarSign',
        categoryColor: cat?.color ?? '#94A3B8',
      };
    });

  const savingsTotal = savingsEmergency + savingsGoal;
  const netSaved = income - expenses - savingsTotal;
  const savingsRatePct = income > 0 ? (savingsTotal / income) * 100 : 0;

  let spendMoMChangePct: number | null = null;
  let spendMoMLabel = '';
  if (prevExpenses > 0) {
    spendMoMChangePct = ((expenses - prevExpenses) / prevExpenses) * 100;
  } else if (expenses > 0) {
    spendMoMLabel = 'No spending last month';
  } else {
    spendMoMLabel = 'No spending this month';
  }

  return {
    month,
    income,
    expenses,
    savingsEmergency,
    savingsGoal,
    savingsTotal,
    netSaved,
    savingsRatePct,
    spendMoMChangePct,
    spendMoMLabel,
    topCategories,
    impulseExpenses,
  };
}

// ─────────────────────────────────────────────────────────────
// Budget suggestion (step 2)
// ─────────────────────────────────────────────────────────────

/**
 * Average spend for `categoryId` across the last `BUDGET_AVG_WINDOW` fully-past
 * months relative to `reviewMonth`. When `reviewMonth` is the just-ended
 * month (typical case), the window is the 3 months preceding the NEXT month
 * — i.e. reviewMonth, reviewMonth-1, reviewMonth-2. Rounded to nearest ₹100.
 * Returns `null` when the category has zero history in those months.
 *
 * For non-savings categories `getSpentForCategory` semantics apply (only
 * expense-typed transactions; savings-category ids are treated as their own
 * category since savings transactions are stored as expense-typed).
 */
export function suggestBudgetForCategory(
  categoryId: string,
  reviewMonth: string,
  transactions: Transaction[],
  window: number = BUDGET_AVG_WINDOW,
): number | null {
  const nextMonth = addMonths(reviewMonth, 1);
  let totalSpend = 0;
  let monthsWithHistory = 0;

  for (let i = 1; i <= window; i++) {
    const m = addMonths(nextMonth, -i);
    let monthSpend = 0;
    let sawAny = false;
    for (const t of transactions) {
      if (t.type !== 'expense') continue;
      if (t.categoryId !== categoryId) continue;
      if (!t.date.startsWith(m)) continue;
      monthSpend += t.amount;
      sawAny = true;
    }
    if (sawAny) {
      totalSpend += monthSpend;
      monthsWithHistory += 1;
    }
  }

  if (monthsWithHistory === 0) return null;
  const avg = totalSpend / monthsWithHistory;
  return Math.round(avg / 100) * 100;
}

// ─────────────────────────────────────────────────────────────
// Test-support helpers (not shipped code paths)
// ─────────────────────────────────────────────────────────────

export function _today(): string {
  return localDateStr(new Date());
}
