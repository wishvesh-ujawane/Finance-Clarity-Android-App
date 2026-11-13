/**
 * Canonical amount and date formatters (DESIGN §4.6). The three amount
 * variants are the only money formatters:
 * - `formatAmount`: display, compact from 1 lakh (`₹1.50 L`, `₹1.20 Cr`).
 * - `formatAmountFull`: full precision for inputs, sheets, confirmations,
 *   CSV, and restore previews (`₹1,50,000`).
 * - `formatAmountShort`: chart axes and chart labels only (`₹12.5k`, `₹1.2L`).
 * Display never shows paise.
 */
import { localDateStr } from '@/lib/domain/periods';

const LAKH = 100_000;
const CRORE = 10_000_000;

const fullFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatAmount(value: number): string {
  const abs = Math.abs(value);
  let formatted: string;
  if (abs >= CRORE) formatted = `₹${(abs / CRORE).toFixed(2)} Cr`;
  else if (abs >= LAKH) formatted = `₹${(abs / LAKH).toFixed(2)} L`;
  else formatted = `₹${Math.round(abs).toLocaleString('en-IN')}`;
  return value < 0 && formatted !== '₹0' ? `-${formatted}` : formatted;
}

export function formatAmountFull(value: number): string {
  return fullFormatter.format(value);
}

export function formatAmountShort(value: number): string {
  if (value >= LAKH) return `₹${(value / LAKH).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}k`;
  return `₹${Math.round(value)}`;
}

/**
 * Formats a raw digit string (or digits with a single decimal point) with
 * Indian-style grouping: last 3 digits, then groups of 2.
 *
 *   formatIndianDigits('')          -> ''
 *   formatIndianDigits('123')       -> '123'
 *   formatIndianDigits('1234')      -> '1,234'
 *   formatIndianDigits('1234567')   -> '12,34,567'
 *   formatIndianDigits('1234.56')   -> '1,234.56'
 *   formatIndianDigits('1,00,000')  -> '1,00,000' (existing commas stripped, re-grouped)
 *
 * Leading zeros are preserved. Non-numeric input (other than an optional
 * trailing decimal) is returned unchanged.
 */
export function formatIndianDigits(numStr: string): string {
  if (!numStr) return numStr;
  const cleaned = numStr.replace(/,/g, '');
  const dotIndex = cleaned.indexOf('.');
  const intPart = dotIndex === -1 ? cleaned : cleaned.slice(0, dotIndex);
  const decPart = dotIndex === -1 ? '' : cleaned.slice(dotIndex);
  if (!/^\d+$/.test(intPart) || intPart.length <= 3) return cleaned;
  const lastThree = intPart.slice(-3);
  const rest = intPart.slice(0, -3);
  const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${grouped},${lastThree}${decPart}`;
}

/**
 * Applies `formatIndianDigits` to each numeric run inside a calculator
 * expression, preserving operators (+, -, x, /) and whitespace.
 *
 *   formatAmountExpression('')            -> ''
 *   formatAmountExpression('250')         -> '250'
 *   formatAmountExpression('10000+2500')  -> '10,000+2,500'
 *   formatAmountExpression('1234.56+500') -> '1,234.56+500'
 */
export function formatAmountExpression(expr: string): string {
  if (!expr) return expr;
  return expr.replace(/\d+(?:\.\d*)?/g, match => formatIndianDigits(match));
}

/** Month as "November 2026". */
export function formatMonthLabel(month: string): string {
  const [year, m] = month.split('-').map(Number);
  return new Date(year, m - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

/** Month as "Nov" (chart axes). */
export function formatMonthShort(month: string): string {
  const [year, m] = month.split('-').map(Number);
  return new Date(year, m - 1).toLocaleDateString('en-IN', { month: 'short' });
}

/** Month as "Nov 2026", where space is tight (DESIGN §3.3, §10). */
export function formatMonthYearShort(month: string): string {
  const [year, m] = month.split('-').map(Number);
  return new Date(year, m - 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

/** Date as "Today", "Yesterday", or a short local date. */
export function formatDateLabel(
  dateStr: string,
  options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' },
  now: Date = new Date(),
): string {
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (dateStr === localDateStr(now)) return 'Today';
  if (dateStr === localDateStr(yesterday)) return 'Yesterday';
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-IN', options);
}
