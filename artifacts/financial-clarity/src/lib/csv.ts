import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isValidDateStr } from '@/lib/finance-utils';
import { Category, Transaction } from '@/lib/types';

export interface ImportedTransactionRow {
  date: string;
  categoryName: string;
  amount: number;
  note: string;
  type: 'income' | 'expense';
}

export interface InvalidCsvRow {
  /** 1-based line number in the file, counting the header as line 1. */
  line: number;
  reason: string;
}

export interface ParsedTransactionsCsv {
  rows: ImportedTransactionRow[];
  invalidRows: InvalidCsvRow[];
}

const CSV_HEADERS = ['Date', 'Category', 'Amount', 'Note', 'Type'];

// Spreadsheet apps execute cells that start with these characters as formulas.
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;
const GUARDED_FORMULA = /^'[=+\-@\t\r]/;

function escapeCsvCell(value: string | number) {
  const text = String(value);
  const safe = FORMULA_TRIGGER.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Reverses the export-side formula guard so a round-trip keeps the original text. */
function unguardCell(value: string) {
  return GUARDED_FORMULA.test(value) ? value.slice(1) : value;
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function normalizeLineEndings(csv: string) {
  return csv.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export function buildTransactionsCsv(transactions: Transaction[], categories: Category[]) {
  const categoryById = new Map(categories.map(category => [category.id, category.name]));
  const rows = transactions
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(transaction => [
      transaction.date,
      categoryById.get(transaction.categoryId) || 'Unknown',
      transaction.amount.toString(),
      transaction.note || '',
      transaction.type,
    ].map(escapeCsvCell).join(','));

  return [CSV_HEADERS.join(','), ...rows].join('\n');
}

export function parseTransactionsCsv(csv: string): ParsedTransactionsCsv {
  const lines = normalizeLineEndings(csv)
    .split('\n')
    .map((text, index) => ({ text, line: index + 1 }))
    .filter(entry => entry.text.trim().length > 0);
  if (lines.length === 0) return { rows: [], invalidRows: [] };

  const headers = parseCsvLine(lines[0].text).map(header => header.trim().toLowerCase());
  const dateIndex = headers.indexOf('date');
  const categoryIndex = headers.indexOf('category');
  const amountIndex = headers.indexOf('amount');
  const noteIndex = headers.indexOf('note');
  const typeIndex = headers.indexOf('type');

  if (dateIndex === -1 || categoryIndex === -1 || amountIndex === -1 || typeIndex === -1) {
    throw new Error('CSV must include Date, Category, Amount, and Type columns.');
  }

  const rows: ImportedTransactionRow[] = [];
  const invalidRows: InvalidCsvRow[] = [];

  for (const { text, line } of lines.slice(1)) {
    const cells = parseCsvLine(text);
    const date = (cells[dateIndex] || '').trim();
    const categoryName = unguardCell((cells[categoryIndex] || '').trim());
    const rawAmount = (cells[amountIndex] || '').trim();
    const amount = /^\d+(\.\d+)?$/.test(rawAmount) ? Number(rawAmount) : Number.NaN;
    const note = noteIndex === -1 ? '' : unguardCell((cells[noteIndex] || '').trim());
    const type = (cells[typeIndex] || '').trim().toLowerCase();

    let reason = '';
    if (!isValidDateStr(date)) reason = 'invalid date';
    else if (!categoryName) reason = 'missing category';
    else if (!Number.isFinite(amount) || amount <= 0) reason = 'invalid amount';
    else if (type !== 'income' && type !== 'expense') reason = 'invalid type';

    if (reason) {
      invalidRows.push({ line, reason });
      continue;
    }
    rows.push({ date, categoryName, amount, note, type: type as 'income' | 'expense' });
  }

  return { rows, invalidRows };
}

export interface CsvImportPlan {
  /** Rows to add, with an existing category id or the key of a category to create. */
  items: Array<{ row: ImportedTransactionRow; categoryId?: string; newCategoryKey?: string }>;
  duplicateCount: number;
  categoriesToCreate: Array<{ key: string; name: string; type: 'income' | 'expense' }>;
}

// CSV rows only carry "income" or "expense". Expense rows may belong to any
// outflow category; reserved savings categories are checked first so savings
// contributions are not re-created as spending.
const COMPATIBLE_CATEGORY_TYPES: Record<'income' | 'expense', Category['type'][]> = {
  expense: ['savings', 'commitment', 'expense', 'both'],
  income: ['income', 'both'],
};

function duplicateKey(input: { date: string; type: string; amount: number; categoryKey: string; note: string }) {
  return [input.date, input.type, input.amount.toFixed(2), input.categoryKey, input.note].join('|');
}

/**
 * Works out what an import would change, without changing anything.
 * Rows identical to an existing transaction (same date, type, amount,
 * category, and note) are counted as duplicates, respecting repeat counts.
 */
export function planCsvImport(
  rows: ImportedTransactionRow[],
  transactions: Transaction[],
  categories: Category[],
): CsvImportPlan {
  const existingCounts: Record<string, number> = {};
  for (const transaction of transactions) {
    const key = duplicateKey({ ...transaction, categoryKey: transaction.categoryId, note: transaction.note || '' });
    existingCounts[key] = (existingCounts[key] || 0) + 1;
  }

  const findCategory = (name: string, rowType: 'income' | 'expense') => {
    const lower = name.toLowerCase();
    for (const type of COMPATIBLE_CATEGORY_TYPES[rowType]) {
      const match = categories.find(category => category.type === type && category.name.toLowerCase() === lower);
      if (match) return match;
    }
    return undefined;
  };

  const plan: CsvImportPlan = { items: [], duplicateCount: 0, categoriesToCreate: [] };
  const seenCounts: Record<string, number> = {};

  for (const row of rows) {
    const category = findCategory(row.categoryName, row.type);
    let categoryKey: string;
    if (category) {
      categoryKey = category.id;
    } else {
      categoryKey = `new:${row.type}:${row.categoryName.toLowerCase()}`;
      if (!plan.categoriesToCreate.some(entry => entry.key === categoryKey)) {
        plan.categoriesToCreate.push({ key: categoryKey, name: row.categoryName, type: row.type });
      }
    }

    const key = duplicateKey({ ...row, categoryKey });
    const seen = seenCounts[key] || 0;
    seenCounts[key] = seen + 1;
    if ((existingCounts[key] || 0) > seen) {
      plan.duplicateCount += 1;
      continue;
    }
    plan.items.push(category ? { row, categoryId: category.id } : { row, newCategoryKey: categoryKey });
  }

  plan.categoriesToCreate = plan.categoriesToCreate.filter(entry =>
    plan.items.some(item => item.newCategoryKey === entry.key),
  );
  return plan;
}

function webDownloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportCsvFile(filename: string, csv: string) {
  if (Capacitor.isNativePlatform()) {
    const path = `exports/${filename}`;
    await Filesystem.writeFile({
      path,
      data: csv,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
      recursive: true,
    });
    const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
    await Share.share({
      title: filename,
      text: 'Fiscal Focus CSV export',
      files: [uri],
      dialogTitle: 'Export CSV',
    });
    return;
  }

  webDownloadCsv(filename, csv);
}
