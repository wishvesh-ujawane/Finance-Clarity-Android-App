/**
 * Period boundaries for financial data (PRD §6, DATABASE §2). Financial dates
 * are local `YYYY-MM-DD` strings and months are `YYYY-MM` strings, so every
 * boundary is a string comparison in the device's local calendar.
 */

/** Local calendar date of `d` as `YYYY-MM-DD`. */
export function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** True for a real calendar date in `YYYY-MM-DD` form (rejects 2026-02-30, 2026-13-01). */
export function isValidDateStr(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** Local calendar month of `now` as `YYYY-MM`. */
export function currentMonth(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** Month (`YYYY-MM`) that a `YYYY-MM-DD` date falls in. */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function isInMonth(date: string, month: string): boolean {
  return monthOf(date) === month;
}

/** True when `date` is in a month before `month`. */
export function isBeforeMonth(date: string, month: string): boolean {
  return monthOf(date) < month;
}

export function addMonths(month: string, delta: number): string {
  const [year, m] = month.split('-').map(Number);
  const d = new Date(year, m - 1 + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Last calendar date of `month` as `YYYY-MM-DD` (handles leap years). */
export function lastDateOfMonth(month: string): string {
  const [year, m] = month.split('-').map(Number);
  return `${month}-${String(new Date(year, m, 0).getDate()).padStart(2, '0')}`;
}

export type MonthStatus = 'past' | 'current' | 'future';

/** Returns whether the given YYYY-MM month is past, current, or future. */
export function getMonthStatus(month: string, now: Date = new Date()): MonthStatus {
  const cur = currentMonth(now);
  if (month < cur) return 'past';
  if (month > cur) return 'future';
  return 'current';
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
