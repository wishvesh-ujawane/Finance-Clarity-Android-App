import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prepareStorage } from '../startup';
import { STORAGE_KEYS } from '../keys';

describe('prepareStorage', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('returns the finance load and any quarantined keys', () => {
    localStorage.setItem(STORAGE_KEYS.budgets, '[{"id":"b"}]');
    const result = prepareStorage([]);
    expect(result.ok && result.load.quarantined).toEqual([{ key: 'budgets', invalidCount: 1, preserved: true }]);
  });

  it('stops before reading when the stored version is newer', () => {
    localStorage.setItem(STORAGE_KEYS.storageVersion, '9');
    localStorage.setItem(STORAGE_KEYS.transactions, '[{"id":1}]');

    expect(prepareStorage([])).toEqual({ ok: false, problem: 'newer-version' });
    expect(localStorage.length).toBe(2);
  });

  it('maps a full store during migration to storage-full', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    expect(prepareStorage([{ version: 1, migrate: () => [] }])).toEqual({ ok: false, problem: 'storage-full' });
  });

  it('reports unpreserved data with the load so the user can choose to continue', () => {
    localStorage.setItem(STORAGE_KEYS.transactions, '[{"id":1}]');
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      if (k.startsWith('financial-clarity:backup:')) throw new DOMException('full', 'QuotaExceededError');
      return original.call(this, k, v);
    });

    const result = prepareStorage([]);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.problem).toBe('unpreserved');
    expect(!result.ok && result.problem === 'unpreserved' && result.load.quarantined).toEqual([
      { key: 'transactions', invalidCount: 1, preserved: false },
    ]);
  });

  it('reports unavailable storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(prepareStorage([])).toEqual({ ok: false, problem: 'unavailable' });
  });
});
