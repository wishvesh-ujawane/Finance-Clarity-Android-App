/**
 * Compatibility exports. Formatters live in `lib/format.ts`, period helpers in
 * `lib/domain/periods.ts`, and financial rules in `lib/domain/finance-metrics.ts`.
 * New code should import from those modules directly.
 */
import { formatAmountFull, formatAmountShort, formatMonthLabel } from '@/lib/format';

export {
  formatAmount,
  formatAmountExpression,
  formatDateLabel,
  formatIndianDigits,
  formatMonthLabel,
} from '@/lib/format';
export {
  addMonths,
  currentMonth,
  getMonthStatus,
  isValidDateStr,
  localDateStr,
  monthsBetween,
  type MonthStatus,
} from '@/lib/domain/periods';
export { isConsumptionExpense } from '@/lib/domain/finance-metrics';

/** @deprecated Use `formatAmountFull` (full precision) or `formatAmount` (display) from `lib/format`. */
export const formatINR = formatAmountFull;
/** @deprecated Use `formatAmountShort` from `lib/format`. Chart labels only. */
export const formatShortINR = formatAmountShort;
/** @deprecated Same output as `formatMonthLabel`. */
export const formatMonthYear = formatMonthLabel;

export interface MoMChange {
  /** Percentage change, or null if a change cannot be expressed meaningfully. */
  pct: number | null;
  /** Reason label when pct is null; empty string when pct is a valid number. */
  label: string;
}

/**
 * Month-over-month percentage change with explicit "cannot compute" cases.
 * Returns `pct: null` (with a reason label) for first-month, no-prior-data,
 * or in-progress current months — callers should render "—" in those cases.
 */
export function getMonthOverMonthChange(
  current: number,
  previous: number,
  opts: { previousHasData: boolean; currentMonthInProgress: boolean },
): MoMChange {
  if (!opts.previousHasData) return { pct: null, label: 'First recorded month' };
  if (previous === 0) return { pct: null, label: 'No prior data' };
  if (opts.currentMonthInProgress) return { pct: null, label: 'Month in progress' };
  return { pct: ((current - previous) / previous) * 100, label: '' };
}
