/**
 * Analysis selectors (PRD FR-08). Built on the PRD §6 classification so the
 * Analysis tabs agree with the Dashboard, Budgets, and Transactions screens.
 */
import {
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
    if (isIncome(tx)) balance += tx.amount;
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

/** Consumption per weekday in `month`, Monday first, with per-category totals. */
export function consumptionByWeekday<T extends MetricTransaction>(
  transactions: readonly T[],
  month: string,
): { totals: number[]; byCategory: Array<Record<string, number>> } {
  const totals = [0, 0, 0, 0, 0, 0, 0];
  const byCategory: Array<Record<string, number>> = totals.map(() => ({}));
  for (const tx of transactions) {
    if (!isInMonth(tx.date, month) || !isConsumptionExpense(tx)) continue;
    const jsDay = new Date(`${tx.date}T00:00:00`).getDay();
    const idx = jsDay === 0 ? 6 : jsDay - 1;
    totals[idx] += tx.amount;
    byCategory[idx][tx.categoryId] = (byCategory[idx][tx.categoryId] ?? 0) + tx.amount;
  }
  return { totals, byCategory };
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

/**
 * Day-to-day consumption per day of `month` for the budget pace chart:
 * consumption outside commitment categories, leaving out entries generated
 * by recurring rules (fixed bills, identified by their stored rule ID).
 */
export function dayToDayPaceByDay(
  transactions: ReadonlyArray<MetricTransaction & { recurringRuleId?: string }>,
  commitmentIds: ReadonlySet<string>,
  month: string,
): Record<number, number> {
  const days: Record<number, number> = {};
  for (const tx of transactions) {
    if (!isInMonth(tx.date, month) || !isConsumptionExpense(tx)) continue;
    if (commitmentIds.has(tx.categoryId) || tx.recurringRuleId) continue;
    const day = Number(tx.date.slice(8, 10));
    days[day] = (days[day] ?? 0) + tx.amount;
  }
  return days;
}

/**
 * Months before `month` that contain at least one entry. Forecasts need at
 * least one such month; otherwise they show "insufficient history".
 */
export function monthsOfHistoryBefore(transactions: readonly MetricTransaction[], month: string): number {
  return new Set(transactions.map(tx => monthOf(tx.date)).filter(m => m < month)).size;
}
