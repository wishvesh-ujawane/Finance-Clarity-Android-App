import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addCategoryActiveFlag, assignBudgetMonths, requireBudgetMonth } from '../local-migrations';
import { LOCAL_MIGRATIONS, runLocalMigrations } from '../migrations';
import { STORAGE_KEYS } from '../keys';

const CAT_KEY = STORAGE_KEYS.categories;
const BUDGET_KEY = STORAGE_KEYS.budgets;

function quarantineCopies(): string[] {
  return Object.keys(localStorage).filter(key => key.startsWith('financial-clarity:backup:budgets:'));
}

describe('local migration 1: category active flag', () => {
  beforeEach(() => localStorage.clear());

  it('marks categories without a status active and keeps explicit values', () => {
    localStorage.setItem(CAT_KEY, JSON.stringify([
      { id: 'a', name: 'A', icon: 'X', color: '#000000', type: 'expense' },
      { id: 'b', name: 'B', icon: 'X', color: '#000000', type: 'expense', active: false },
    ]));
    const writes = addCategoryActiveFlag.migrate();
    expect(writes).toEqual([[CAT_KEY, [
      { id: 'a', name: 'A', icon: 'X', color: '#000000', type: 'expense', active: true },
      { id: 'b', name: 'B', icon: 'X', color: '#000000', type: 'expense', active: false },
    ]]]);
  });

  it('writes nothing when there is nothing to change or the data is unreadable', () => {
    expect(addCategoryActiveFlag.migrate()).toEqual([]);
    localStorage.setItem(CAT_KEY, '{broken');
    expect(addCategoryActiveFlag.migrate()).toEqual([]);
    localStorage.setItem(CAT_KEY, '[{"id":"a","active":true}]');
    expect(addCategoryActiveFlag.migrate()).toEqual([]);
  });
});

describe('local migration 2: budgets need a month', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 15));
    localStorage.clear();
  });
  afterEach(() => vi.useRealTimers());

  it('gives a month-less budget the current month', () => {
    localStorage.setItem(BUDGET_KEY, JSON.stringify([{ id: 'b1', categoryId: 'rent', limit: 100 }]));
    expect(requireBudgetMonth.migrate()).toEqual([[BUDGET_KEY, [{ id: 'b1', categoryId: 'rent', limit: 100, month: '2026-11' }]]]);
  });

  it('keeps the row that already had a month and quarantines the original data first', () => {
    const raw = JSON.stringify([
      { id: 'old', categoryId: 'rent', limit: 100 },
      { id: 'new', categoryId: 'rent', limit: 200, month: '2026-11' },
    ]);
    localStorage.setItem(BUDGET_KEY, raw);

    const result = runLocalMigrations([addCategoryActiveFlag, requireBudgetMonth]);

    expect(result).toEqual({ ok: true, version: 2, applied: [1, 2] });
    expect(JSON.parse(localStorage.getItem(BUDGET_KEY) ?? '[]')).toEqual([
      { id: 'new', categoryId: 'rent', limit: 200, month: '2026-11' },
    ]);
    const copies = quarantineCopies();
    expect(copies).toHaveLength(1);
    expect(localStorage.getItem(copies[0])).toBe(raw);
  });

  it('assigns months without touching rows that already have one', () => {
    expect(assignBudgetMonths([{ id: 'x', categoryId: 'a', month: '2026-01' }, 'junk'], '2026-11')).toEqual({
      items: [{ id: 'x', categoryId: 'a', month: '2026-01' }, 'junk'],
      changed: false,
      dropped: 0,
    });
  });
});

describe('registered migrations', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('run once, write the version last, and do nothing on the next launch', () => {
    localStorage.setItem(CAT_KEY, '[{"id":"a","name":"A","icon":"X","color":"#000000","type":"expense"}]');
    expect(runLocalMigrations(LOCAL_MIGRATIONS)).toMatchObject({ ok: true, version: 2, applied: [1, 2] });
    expect(localStorage.getItem(STORAGE_KEYS.storageVersion)).toBe('2');

    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    expect(runLocalMigrations(LOCAL_MIGRATIONS)).toEqual({ ok: true, version: 2, applied: [] });
    expect(setItem).not.toHaveBeenCalled();
  });

  it('leaves categories unchanged when the version cannot be saved', () => {
    const raw = '[{"id":"a","name":"A","icon":"X","color":"#000000","type":"expense"}]';
    localStorage.setItem(CAT_KEY, raw);
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      if (k === STORAGE_KEYS.storageVersion) throw new DOMException('full', 'QuotaExceededError');
      return original.call(this, k, v);
    });

    expect(runLocalMigrations(LOCAL_MIGRATIONS)).toEqual({ ok: false, error: 'quota', version: 0 });
    expect(localStorage.getItem(CAT_KEY)).toBe(raw);
  });
});
