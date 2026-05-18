import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Category, Transaction } from '@/lib/types';

export interface ImportedTransactionRow {
  date: string;
  categoryName: string;
  amount: number;
  note: string;
  type: 'income' | 'expense';
}

const CSV_HEADERS = ['Date', 'Category', 'Amount', 'Note', 'Type'];

function escapeCsvCell(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
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

export function parseTransactionsCsv(csv: string): ImportedTransactionRow[] {
  const lines = normalizeLineEndings(csv).split('\n').filter(line => line.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]).map(header => header.trim().toLowerCase());
  const dateIndex = headers.indexOf('date');
  const categoryIndex = headers.indexOf('category');
  const amountIndex = headers.indexOf('amount');
  const noteIndex = headers.indexOf('note');
  const typeIndex = headers.indexOf('type');

  if (dateIndex === -1 || categoryIndex === -1 || amountIndex === -1 || typeIndex === -1) {
    throw new Error('CSV must include Date, Category, Amount, and Type columns.');
  }

  return lines.slice(1).map((line, index) => {
    const cells = parseCsvLine(line);
    const date = (cells[dateIndex] || '').trim();
    const categoryName = (cells[categoryIndex] || '').trim();
    const amount = Number.parseFloat((cells[amountIndex] || '').trim());
    const note = noteIndex === -1 ? '' : (cells[noteIndex] || '').trim();
    const type = (cells[typeIndex] || '').trim().toLowerCase();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error(`Row ${index + 2} has an invalid date.`);
    }
    if (!categoryName) {
      throw new Error(`Row ${index + 2} is missing a category.`);
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error(`Row ${index + 2} has an invalid amount.`);
    }
    if (type !== 'income' && type !== 'expense') {
      throw new Error(`Row ${index + 2} has an invalid type.`);
    }

    return { date, categoryName, amount, note, type };
  });
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
      text: 'Financial Clarity CSV export',
      files: [uri],
      dialogTitle: 'Export CSV',
    });
    return;
  }

  webDownloadCsv(filename, csv);
}
