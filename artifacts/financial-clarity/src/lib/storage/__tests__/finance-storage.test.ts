import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FINANCE_STORAGE_KEYS,
  STORAGE_FULL_MESSAGE,
  STORAGE_UNAVAILABLE_MESSAGE,
  writeFinanceData,
  writeStorageEntries,
} from '../finance-storage';

function failOnKey(key: string, error: DOMException) {
  const original = Storage.prototype.setItem;
  return vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
    if (k === key) throw error;
    return original.call(this, k, v);
  });
}

describe('writeStorageEntries', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('writes JSON values and removes keys given undefined', () => {
    localStorage.setItem('k:remove', '"old"');
    expect(writeStorageEntries([['k:a', [1, 2]], ['k:remove', undefined]])).toEqual({ ok: true });
    expect(localStorage.getItem('k:a')).toBe('[1,2]');
    expect(localStorage.getItem('k:remove')).toBeNull();
  });

  it('rolls back earlier writes when a later write hits the quota', () => {
    localStorage.setItem('k:a', '"before"');
    failOnKey('k:c', new DOMException('full', 'QuotaExceededError'));

    const result = writeStorageEntries([['k:a', 'after'], ['k:b', 'new'], ['k:c', 'boom']]);

    expect(result).toEqual({ ok: false, error: 'quota', message: STORAGE_FULL_MESSAGE });
    expect(localStorage.getItem('k:a')).toBe('"before"');
    expect(localStorage.getItem('k:b')).toBeNull();
    expect(localStorage.getItem('k:c')).toBeNull();
  });

  it('reports other storage errors as unavailable', () => {
    failOnKey('k:a', new DOMException('denied', 'SecurityError'));
    expect(writeStorageEntries([['k:a', 1]])).toEqual({
      ok: false, error: 'unavailable', message: STORAGE_UNAVAILABLE_MESSAGE,
    });
  });
});

describe('writeFinanceData', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('writes categories, then transactions, then recurring cursors (DATABASE §7.3)', () => {
    const order: string[] = [];
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      order.push(k);
      return original.call(this, k, v);
    });

    expect(writeFinanceData({ recurring: [], transactions: [], categories: [] })).toEqual({ ok: true });
    expect(order).toEqual([
      FINANCE_STORAGE_KEYS.categories,
      FINANCE_STORAGE_KEYS.transactions,
      FINANCE_STORAGE_KEYS.recurring,
    ]);
  });

  it('leaves transactions unchanged if the recurring cursor cannot be saved', () => {
    localStorage.setItem(FINANCE_STORAGE_KEYS.transactions, '[]');
    failOnKey(FINANCE_STORAGE_KEYS.recurring, new DOMException('full', 'QuotaExceededError'));

    const result = writeFinanceData({ transactions: [{ id: 'x' }], recurring: [{ id: 'r' }] });

    expect(result.ok).toBe(false);
    expect(localStorage.getItem(FINANCE_STORAGE_KEYS.transactions)).toBe('[]');
  });
});
