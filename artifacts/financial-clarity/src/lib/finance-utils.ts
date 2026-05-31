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

export function addMonths(month: string, delta: number): string {
  const [year, m] = month.split('-').map(Number);
  const d = new Date(year, m - 1 + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
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
