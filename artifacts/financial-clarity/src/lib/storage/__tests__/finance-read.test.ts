import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFinanceData } from '../finance-read';
import { STORAGE_KEYS } from '../keys';

const tx = { id: 't1', type: 'expense', amount: 100, categoryId: 'groceries', note: 'synthetic', date: '2026-11-01' };

function quarantineEntries(): Array<[string, string | null]> {
  const entries: Array<[string, string | null]> = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('financial-clarity:backup:')) entries.push([key, localStorage.getItem(key)]);
  }
  return entries;
}

describe('readFinanceData', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('returns empty data and writes nothing when storage is empty', () => {
    const result = readFinanceData();
    expect(result).toEqual({
      ok: true,
      quarantined: [],
      data: { transactions: [], categories: [], budgets: [], recurringExpenses: [], reconciliations: [], savingsGoal: null },
    });
    expect(localStorage.length).toBe(0);
  });

  it('quarantines the raw text when some records are invalid and returns the valid ones', () => {
    const raw = JSON.stringify([tx, { id: 'bad', amount: 'NaN' }]);
    localStorage.setItem(STORAGE_KEYS.transactions, raw);

    const result = readFinanceData();

    expect(result.ok && result.data.transactions).toEqual([tx]);
    expect(result.ok && result.quarantined).toEqual([{ key: 'transactions', invalidCount: 1, preserved: true }]);
    const copies = quarantineEntries();
    expect(copies).toHaveLength(1);
    expect(copies[0][0]).toMatch(/^financial-clarity:backup:transactions:\d+$/);
    expect(copies[0][1]).toBe(raw);
    expect(localStorage.getItem(STORAGE_KEYS.transactions)).toBe(raw);
  });

  it('quarantines keys that are not valid JSON or not an array', () => {
    localStorage.setItem(STORAGE_KEYS.budgets, '{not json');
    localStorage.setItem(STORAGE_KEYS.categories, '{"id":"x"}');

    const result = readFinanceData();

    expect(result.ok && result.quarantined).toEqual([
      { key: 'categories', invalidCount: null, preserved: true },
      { key: 'budgets', invalidCount: null, preserved: true },
    ]);
    expect(quarantineEntries().map(([, raw]) => raw).sort()).toEqual(['{"id":"x"}', '{not json']);
  });

  it('does not copy the same corrupt data again on the next launch', () => {
    localStorage.setItem(STORAGE_KEYS.recurring, '[{"id":1}]');
    readFinanceData();
    const second = readFinanceData();

    expect(second.ok && second.quarantined).toEqual([{ key: 'recurring', invalidCount: 1, preserved: true }]);
    expect(quarantineEntries()).toHaveLength(1);
  });

  it('loads the legacy single-bucket savings shape into the goal bucket without quarantine', () => {
    localStorage.setItem(STORAGE_KEYS.savingsGoal, JSON.stringify({ monthly: 500, annual: 6000 }));
    const result = readFinanceData();
    expect(result.ok && result.data.savingsGoal).toEqual({
      goal: { monthly: 500, annual: 6000 },
      emergency: { monthly: 0, annual: 0 },
    });
    expect(result.ok && result.quarantined).toEqual([]);
  });

  it('keeps the valid savings bucket and quarantines an invalid one', () => {
    const raw = JSON.stringify({ goal: { monthly: 100, annual: 1200, createdAt: '2026-01-01' }, emergency: { monthly: 'x' } });
    localStorage.setItem(STORAGE_KEYS.savingsGoal, raw);

    const result = readFinanceData();

    expect(result.ok && result.data.savingsGoal).toEqual({
      goal: { monthly: 100, annual: 1200, createdAt: '2026-01-01' },
      emergency: { monthly: 0, annual: 0 },
    });
    expect(result.ok && result.quarantined).toEqual([{ key: 'savingsGoal', invalidCount: 1, preserved: true }]);
    expect(quarantineEntries()[0][1]).toBe(raw);
  });

  it('quarantines an unreadable savings goal instead of dropping it', () => {
    localStorage.setItem(STORAGE_KEYS.savingsGoal, '"oops"');
    const result = readFinanceData();
    expect(result.ok && result.data.savingsGoal).toBeNull();
    expect(result.ok && result.quarantined).toEqual([{ key: 'savingsGoal', invalidCount: null, preserved: true }]);
  });

  it('reports preserved: false and leaves the original when the quarantine copy cannot be saved', () => {
    const raw = '[{"id":1}]';
    localStorage.setItem(STORAGE_KEYS.transactions, raw);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });

    const result = readFinanceData();

    expect(result.ok && result.quarantined).toEqual([{ key: 'transactions', invalidCount: 1, preserved: false }]);
    expect(localStorage.getItem(STORAGE_KEYS.transactions)).toBe(raw);
  });

  it('returns unavailable when storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(readFinanceData()).toEqual({ ok: false, error: 'unavailable' });
  });

  it('writes nothing when quarantine is turned off', () => {
    localStorage.setItem(STORAGE_KEYS.transactions, '[{"id":1}]');
    const result = readFinanceData({ quarantine: false });
    expect(result.ok && result.quarantined).toEqual([{ key: 'transactions', invalidCount: 1, preserved: true }]);
    expect(quarantineEntries()).toEqual([]);
  });
});
