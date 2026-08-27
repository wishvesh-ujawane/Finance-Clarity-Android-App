export function formatINR(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Canonical currency formatter. Use everywhere.
 * - >= 1 Cr: ₹X.XX Cr (kept beyond spec to avoid huge L numbers)
 * - >= 1 L:  ₹X.XX L
 * - otherwise: ₹X,XX,XXX (en-IN grouping)
 */
export function formatAmount(value: number): string {
  const abs = Math.abs(value);
  let formatted: string;
  if (abs >= 10000000) formatted = `₹${(abs / 10000000).toFixed(2)} Cr`;
  else if (abs >= 100000) formatted = `₹${(abs / 100000).toFixed(2)} L`;
  else formatted = `₹${abs.toLocaleString('en-IN')}`;
  return value < 0 ? `-${formatted}` : formatted;
}

// Back-compat alias — keeps existing call sites working against the single canonical impl.
export const formatINRCompact = formatAmount;

export function formatShortINR(amount: number) {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}k`;
  return `₹${Math.round(amount)}`;
}

export function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function formatMonthLabel(month: string) {
  const [year, m] = month.split('-');
  return new Date(parseInt(year), parseInt(m) - 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
}

export function formatMonthYear(month: string) {
  const [year, m] = month.split('-').map(Number);
  return new Date(year, m - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

export function addMonths(month: string, delta: number): string {
  const [year, m] = month.split('-').map(Number);
  const d = new Date(year, m - 1 + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export type MonthStatus = 'past' | 'current' | 'future';

/** Returns whether the given YYYY-MM month is past, current, or future. */
export function getMonthStatus(month: string): MonthStatus {
  const cur = currentMonth();
  if (month < cur) return 'past';
  if (month > cur) return 'future';
  return 'current';
}

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

/**
 * Returns the number of whole calendar months between two YYYY-MM-DD dates.
 * Always non-negative; if `to` is before `from`, returns 0.
 */
export function monthsBetween(fromDate: string, toDate: string): number {
  const [fy, fm] = fromDate.slice(0, 7).split('-').map(Number);
  const [ty, tm] = toDate.slice(0, 7).split('-').map(Number);
  const diff = (ty - fy) * 12 + (tm - fm);
  return Math.max(0, diff);
}

export function formatDateLabel(
  dateStr: string,
  options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' },
) {
  const d = new Date(`${dateStr}T00:00:00`);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (dateStr === localDateStr(today)) return 'Today';
  if (dateStr === localDateStr(yesterday)) return 'Yesterday';
  return d.toLocaleDateString('en-IN', options);
}

/**
 * Returns true if the transaction is a *consumption* expense — one that
 * should count against monthly spend, budget usage, and Analysis totals.
 *
 * A transaction is NOT consumption when either:
 *   - Its `paymentMethod` is `'credit-card-payment'` (the transaction is a
 *     transfer from a bank account to a credit card, not a purchase — the
 *     underlying purchase is already recorded separately, so counting the
 *     payment would double-count spend).
 *   - It flows into a savings category (money set aside, not consumed).
 *
 * Legacy rows without a `paymentMethod` are treated as consumption — this
 * preserves byte-identical behavior for all pre-SMS-import data.
 */
export function isConsumptionExpense(
  tx: { type: 'income' | 'expense'; categoryId: string; paymentMethod?: string },
): boolean {
  if (tx.type !== 'expense') return false;
  // Card bill payments are transfers, not consumption — the underlying
  // credit-card purchase is (or will be) recorded separately.
  if (tx.paymentMethod === 'credit-card-payment') return false;
  // Savings-category expenses fund savings goals; they flow into savings
  // metrics instead of consumption totals.
  if (tx.categoryId === 'savings-goal' || tx.categoryId === 'savings-emergency') return false;
  return true;
}
