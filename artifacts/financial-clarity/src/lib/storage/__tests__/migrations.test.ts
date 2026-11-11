import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runLocalMigrations, type LocalMigration } from '../migrations';
import { STORAGE_KEYS } from '../keys';

const VERSION_KEY = STORAGE_KEYS.storageVersion;

/** Synthetic step: adds `active: true` to each stored item that lacks it (idempotent). */
function addActiveFlag(version: number, key: string): LocalMigration {
  return {
    version,
    migrate: () => {
      const items = JSON.parse(localStorage.getItem(key) ?? '[]') as Array<Record<string, unknown>>;
      return [[key, items.map(item => ('active' in item ? item : { ...item, active: true }))]];
    },
  };
}

describe('runLocalMigrations', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('does nothing when no steps are registered and no version is stored', () => {
    expect(runLocalMigrations([])).toEqual({ ok: true, version: 0, applied: [] });
    expect(localStorage.getItem(VERSION_KEY)).toBeNull();
  });

  it('runs pending steps in order and writes each version after its data', () => {
    localStorage.setItem('k:a', '[{"id":"1"}]');
    const order: string[] = [];
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      order.push(`${k}=${v}`);
      return original.call(this, k, v);
    });

    const result = runLocalMigrations([addActiveFlag(2, 'k:b'), addActiveFlag(1, 'k:a')]);

    expect(result).toEqual({ ok: true, version: 2, applied: [1, 2] });
    expect(order).toEqual([
      'k:a=[{"id":"1","active":true}]',
      `${VERSION_KEY}=1`,
      'k:b=[]',
      `${VERSION_KEY}=2`,
    ]);
  });

  it('is a no-op when run again', () => {
    localStorage.setItem('k:a', '[{"id":"1"}]');
    const step = addActiveFlag(1, 'k:a');
    runLocalMigrations([step]);
    const migrate = vi.spyOn(step, 'migrate');

    expect(runLocalMigrations([step])).toEqual({ ok: true, version: 1, applied: [] });
    expect(migrate).not.toHaveBeenCalled();
    expect(localStorage.getItem('k:a')).toBe('[{"id":"1","active":true}]');
  });

  it('rolls back the step and keeps the old version when a write fails', () => {
    localStorage.setItem('k:a', '[{"id":"1"}]');
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      if (k === VERSION_KEY) throw new DOMException('full', 'QuotaExceededError');
      return original.call(this, k, v);
    });

    const result = runLocalMigrations([addActiveFlag(1, 'k:a')]);

    expect(result).toEqual({ ok: false, error: 'quota', version: 0 });
    expect(localStorage.getItem('k:a')).toBe('[{"id":"1"}]');
    expect(localStorage.getItem(VERSION_KEY)).toBeNull();
  });

  it('stops after the last successful step when a later step throws', () => {
    localStorage.setItem('k:a', '[]');
    const failing: LocalMigration = { version: 2, migrate: () => { throw new Error('bad data'); } };

    const result = runLocalMigrations([addActiveFlag(1, 'k:a'), failing]);

    expect(result).toEqual({ ok: false, error: 'migration-failed', version: 1 });
    expect(localStorage.getItem(VERSION_KEY)).toBe('1');
  });

  it('refuses data from a newer app version without changing it', () => {
    localStorage.setItem(VERSION_KEY, '5');
    localStorage.setItem('k:a', '[{"id":"1"}]');

    expect(runLocalMigrations([addActiveFlag(1, 'k:a')])).toEqual({ ok: false, error: 'newer-version', version: 5 });
    expect(localStorage.getItem('k:a')).toBe('[{"id":"1"}]');
  });

  it('refuses an invalid stored version', () => {
    localStorage.setItem(VERSION_KEY, '"abc"');
    expect(runLocalMigrations([])).toEqual({ ok: false, error: 'invalid-version' });
  });

  it('refuses a gap in step versions', () => {
    expect(runLocalMigrations([addActiveFlag(2, 'k:a')])).toEqual({ ok: false, error: 'migration-failed', version: 0 });
    expect(localStorage.getItem(VERSION_KEY)).toBeNull();
  });

  it('reports unavailable storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(runLocalMigrations([])).toEqual({ ok: false, error: 'unavailable' });
  });
});
