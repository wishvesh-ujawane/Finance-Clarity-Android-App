import { describe, expect, it } from 'vitest';
import { buildTransactionsCsv, parseTransactionsCsv, planCsvImport } from '@/lib/csv';
import { isValidDateStr } from '@/lib/finance-utils';
import type { Category, Transaction } from '@/lib/types';

const categories: Category[] = [
  { id: 'groceries', name: 'Groceries', icon: 'ShoppingCart', color: '#10B981', type: 'expense' },
  { id: 'rent', name: 'Rent', icon: 'Home', color: '#6366F1', type: 'commitment' },
  { id: 'salary', name: 'Salary', icon: 'Briefcase', color: '#10B981', type: 'income' },
  { id: 'savings-emergency', name: 'Emergency Fund', icon: 'ShieldCheck', color: '#14B8A6', type: 'savings' },
];

function txn(overrides: Partial<Transaction>): Transaction {
  return { id: 't', type: 'expense', amount: 100, categoryId: 'groceries', note: '', date: '2026-11-01', ...overrides };
}

describe('isValidDateStr', () => {
  it('accepts real calendar dates, including leap days', () => {
    expect(isValidDateStr('2026-11-06')).toBe(true);
    expect(isValidDateStr('2024-02-29')).toBe(true);
  });

  it('rejects impossible or malformed dates', () => {
    for (const value of ['2026-13-45', '2026-02-30', '2025-02-29', '2026-1-05', '06-11-2026', '']) {
      expect(isValidDateStr(value)).toBe(false);
    }
  });
});

describe('buildTransactionsCsv', () => {
  it('guards cells that a spreadsheet would run as formulas', () => {
    const csv = buildTransactionsCsv(
      [
        txn({ id: 'a', note: '=HYPERLINK("http://example.invalid","x")' }),
        txn({ id: 'b', note: '+1' }),
        txn({ id: 'c', note: '-5 refund' }),
        txn({ id: 'd', note: '@SUM(A1)' }),
        txn({ id: 'e', note: 'plain note' }),
      ],
      categories,
    );
    expect(csv).not.toMatch(/(^|,)"[=+\-@]/m);
    expect(csv).toContain('"\'=HYPERLINK(""http://example.invalid"",""x"")"');
    expect(csv).toContain('"plain note"');
  });

  it('round-trips guarded notes back to their original text', () => {
    const notes = ['=1+1', '-5 refund', '@home', "it's fine"];
    const csv = buildTransactionsCsv(notes.map((note, i) => txn({ id: String(i), note })), categories);
    const { rows, invalidRows } = parseTransactionsCsv(csv);
    expect(invalidRows).toEqual([]);
    expect(rows.map(row => row.note).sort()).toEqual([...notes].sort());
  });

  it('reports savings corrections instead of importing them as ordinary transactions', () => {
    const correction = txn({ id: 'correction', type: 'income', amount: 5000, categoryId: '_adjustment-savings', savingsCorrection: 'increase' });
    const csv = buildTransactionsCsv([correction], categories);
    const result = parseTransactionsCsv(csv);
    expect(result.rows).toEqual([]);
    expect(result.invalidRows).toEqual([{ line: 2, reason: 'savings corrections require a full backup' }]);
  });
});

describe('parseTransactionsCsv', () => {
  it('keeps valid rows and reports invalid ones with their line number', () => {
    const csv = [
      'Date,Category,Amount,Note,Type',
      '2026-11-01,Groceries,500,ok,expense',
      '2026-13-45,Groceries,500,bad date,expense',
      '2026-11-02,Groceries,"1,200",comma amount,expense',
      '2026-11-03,,10,no category,expense',
      '2026-11-04,Salary,0,zero,income',
      '2026-11-05,Salary,10,bad type,transfer',
    ].join('\n');
    const { rows, invalidRows } = parseTransactionsCsv(csv);
    expect(rows).toEqual([
      { date: '2026-11-01', categoryName: 'Groceries', amount: 500, note: 'ok', type: 'expense' },
    ]);
    expect(invalidRows).toEqual([
      { line: 3, reason: 'invalid date' },
      { line: 4, reason: 'invalid amount' },
      { line: 5, reason: 'missing category' },
      { line: 6, reason: 'invalid amount' },
      { line: 7, reason: 'invalid type' },
    ]);
  });

  it('rejects a file without the required columns', () => {
    expect(() => parseTransactionsCsv('Date,Amount\n2026-11-01,5')).toThrow(/Date, Category, Amount, and Type/);
  });
});

describe('planCsvImport', () => {
  it('maps savings and commitment rows back to their existing categories', () => {
    const existing = [
      txn({ id: '1', categoryId: 'savings-emergency', amount: 5000, note: 'sip' }),
      txn({ id: '2', categoryId: 'rent', amount: 15000, note: 'rent' }),
      txn({ id: '3', type: 'income', categoryId: 'salary', amount: 60000, note: 'pay' }),
    ];
    const { rows } = parseTransactionsCsv(buildTransactionsCsv(existing, categories));
    const plan = planCsvImport(rows, existing, categories);
    expect(plan.items).toEqual([]);
    expect(plan.duplicateCount).toBe(3);
    expect(plan.categoriesToCreate).toEqual([]);
  });

  it('plans new rows against existing categories without creating duplicates', () => {
    const { rows } = parseTransactionsCsv([
      'Date,Category,Amount,Note,Type',
      '2026-11-01,emergency fund,2000,top-up,expense',
      '2026-11-01,Rent,15000,next,expense',
    ].join('\n'));
    const plan = planCsvImport(rows, [], categories);
    expect(plan.items.map(item => item.categoryId)).toEqual(['savings-emergency', 'rent']);
    expect(plan.categoriesToCreate).toEqual([]);
  });

  it('creates each unknown category once and keeps repeated identical rows', () => {
    const { rows } = parseTransactionsCsv([
      'Date,Category,Amount,Note,Type',
      '2026-11-01,Pets,300,food,expense',
      '2026-11-01,Pets,300,food,expense',
      '2026-11-02,Pets,50,toy,expense',
    ].join('\n'));
    const plan = planCsvImport(rows, [], categories);
    expect(plan.items).toHaveLength(3);
    expect(plan.categoriesToCreate).toEqual([{ key: 'new:expense:pets', name: 'Pets', type: 'expense' }]);
    expect(plan.items.every(item => item.newCategoryKey === 'new:expense:pets')).toBe(true);
  });

  it('skips only as many repeats as already exist', () => {
    const existing = [txn({ id: '1', note: 'milk' })];
    const { rows } = parseTransactionsCsv([
      'Date,Category,Amount,Note,Type',
      '2026-11-01,Groceries,100,milk,expense',
      '2026-11-01,Groceries,100,milk,expense',
    ].join('\n'));
    const plan = planCsvImport(rows, existing, categories);
    expect(plan.duplicateCount).toBe(1);
    expect(plan.items).toHaveLength(1);
  });
});
