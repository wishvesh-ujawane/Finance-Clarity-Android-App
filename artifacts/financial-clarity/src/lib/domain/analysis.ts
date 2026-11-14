/**
 * Analysis selectors (PRD FR-08). Built on the PRD §6 classification so the
 * Analysis tabs agree with the Dashboard, Budgets, and Transactions screens.
 */
import {
  consumptionByCategory,
  consumptionByCategoryBetween,
  isConsumptionExpense,
  isIncome,
  isSavingsContribution,
  type MetricTransaction,
} from './finance-metrics';
import { isInMonth, monthOf } from './periods';

/**
 * Spendable balance through `today`: income minus consumption minus savings
 * contributions. Savings set aside are not spendable; card bill payments are
 * transfers and are not counted (their purchases already were).
 */
export function spendableBalance(transactions: readonly MetricTransaction[], today: string): number {
  let balance = 0;
  for (const tx of transactions) {
    if (tx.date > today) continue;
    if (tx.savingsCorrection === 'transfer') balance += tx.amount;
    else if (isIncome(tx)) balance += tx.amount;
    else if (isConsumptionExpense(tx) || isSavingsContribution(tx)) balance -= tx.amount;
  }
  return balance;
}

/** Consumption and savings contributions dated after `today` within `month` (for example scheduled bills). */
export function futureOutflow(transactions: readonly MetricTransaction[], month: string, today: string): number {
  let total = 0;
  for (const tx of transactions) {
    if (!isInMonth(tx.date, month) || tx.date <= today) continue;
    if (isConsumptionExpense(tx) || isSavingsContribution(tx)) total += tx.amount;
  }
  return total;
}

/** Consumption entries in `month` grouped by day of month. */
export function consumptionByDay<T extends MetricTransaction>(
  transactions: readonly T[],
  month: string,
): Record<number, { total: number; txns: T[] }> {
  const days: Record<number, { total: number; txns: T[] }> = {};
  for (const tx of transactions) {
    if (!isInMonth(tx.date, month) || !isConsumptionExpense(tx)) continue;
    const day = Number(tx.date.slice(8, 10));
    days[day] ??= { total: 0, txns: [] };
    days[day].total += tx.amount;
    days[day].txns.push(tx);
  }
  return days;
}

/** Inclusive `YYYY-MM-DD` date range. */
export interface DateRange {
  start: string;
  end: string;
}

export interface CategorySpendChange {
  categoryId: string;
  current: number;
  previous: number;
  /** current − previous. Positive means more was spent. */
  change: number;
  /** Change as a percentage of `previous`; null when `previous` is 0. */
  changePct: number | null;
}

/**
 * Consumption per category in `current` compared with `previous`, sorted by
 * change (largest increase first). Categories with no change are left out.
 */
export function categorySpendChanges(
  transactions: readonly MetricTransaction[],
  current: DateRange,
  previous: DateRange,
): CategorySpendChange[] {
  const now = consumptionByCategoryBetween(transactions, current.start, current.end);
  const before = consumptionByCategoryBetween(transactions, previous.start, previous.end);
  const ids = new Set([...Object.keys(now), ...Object.keys(before)]);
  const rows: CategorySpendChange[] = [];
  for (const categoryId of ids) {
    const cur = now[categoryId] ?? 0;
    const prev = before[categoryId] ?? 0;
    const change = cur - prev;
    if (change === 0) continue;
    rows.push({ categoryId, current: cur, previous: prev, change, changePct: prev > 0 ? (change / prev) * 100 : null });
  }
  return rows.sort((a, b) => b.change - a.change);
}

export interface CategoryTrend {
  /** Top categories by total consumption across `months`, largest first. */
  categoryIds: string[];
  /** One row per month: consumption for each top category (0 when none). */
  points: Array<{ month: string; values: Record<string, number> }>;
  /** Total per top category across `months`. */
  totals: Record<string, number>;
}

/** Monthly consumption for the `limit` largest categories across `months`. */
export function topCategoryTrend(
  transactions: readonly MetricTransaction[],
  months: readonly string[],
  limit = 5,
): CategoryTrend {
  const perMonth = months.map(month => ({ month, byCategory: consumptionByCategory(transactions, month) }));
  const totals: Record<string, number> = {};
  for (const { byCategory } of perMonth) {
    for (const [id, amount] of Object.entries(byCategory)) totals[id] = (totals[id] ?? 0) + amount;
  }
  const categoryIds = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);
  return {
    categoryIds,
    points: perMonth.map(({ month, byCategory }) => ({
      month,
      values: Object.fromEntries(categoryIds.map(id => [id, byCategory[id] ?? 0])),
    })),
    totals: Object.fromEntries(categoryIds.map(id => [id, totals[id]])),
  };
}

/**
 * Months before `month` that contain at least one entry. Forecasts need at
 * least one such month; otherwise they show "insufficient history".
 */
export function monthsOfHistoryBefore(transactions: readonly MetricTransaction[], month: string): number {
  return new Set(transactions.map(tx => monthOf(tx.date)).filter(m => m < month)).size;
}
