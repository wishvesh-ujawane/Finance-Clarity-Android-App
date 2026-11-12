/**
 * Local storage migrations (DATABASE §10.1). Steps run at startup, in order,
 * before any context reads data. Each step is forward-only and idempotent;
 * its writes and the new `storage-version` are saved together, version last,
 * and rolled back together on failure.
 */
import { writeStorageEntries } from './finance-storage';
import { STORAGE_KEYS } from './keys';
import { addCategoryActiveFlag, requireBudgetMonth, reserveSavingsCorrections } from './local-migrations';

export interface LocalMigration {
  /** Storage version after this step. Versions start at 1 and increase by 1. */
  version: number;
  /**
   * Returns the `[key, value]` writes for this step, computed from current
   * storage (`undefined` removes a key). Must not write storage itself.
   */
  migrate: () => Array<[string, unknown]>;
}

/** Registered steps, in order (DATABASE §10.1). */
export const LOCAL_MIGRATIONS: readonly LocalMigration[] = [addCategoryActiveFlag, requireBudgetMonth, reserveSavingsCorrections];

export type MigrationResult =
  | { ok: true; version: number; applied: number[] }
  | { ok: false; error: 'unavailable' | 'quota' | 'invalid-version' | 'newer-version' | 'migration-failed'; version?: number };

function readStoredVersion(): { ok: true; version: number } | { ok: false; error: 'unavailable' | 'invalid-version' } {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEYS.storageVersion);
  } catch {
    return { ok: false, error: 'unavailable' };
  }
  if (raw === null) return { ok: true, version: 0 };
  const version = Number(raw);
  if (!Number.isInteger(version) || version < 0) return { ok: false, error: 'invalid-version' };
  return { ok: true, version };
}

export function runLocalMigrations(migrations: readonly LocalMigration[] = LOCAL_MIGRATIONS): MigrationResult {
  const stored = readStoredVersion();
  if (!stored.ok) return stored;

  const latest = migrations.reduce((max, m) => Math.max(max, m.version), 0);
  // Data written by a newer app may not be readable here; leave it untouched.
  if (stored.version > latest) return { ok: false, error: 'newer-version', version: stored.version };

  const pending = migrations
    .filter(m => m.version > stored.version)
    .sort((a, b) => a.version - b.version);
  const applied: number[] = [];
  let version = stored.version;

  for (const step of pending) {
    if (step.version !== version + 1) return { ok: false, error: 'migration-failed', version };
    let writes: Array<[string, unknown]>;
    try {
      writes = step.migrate();
    } catch {
      return { ok: false, error: 'migration-failed', version };
    }
    const result = writeStorageEntries([...writes, [STORAGE_KEYS.storageVersion, step.version]]);
    if (!result.ok) return { ok: false, error: result.error, version };
    version = step.version;
    applied.push(step.version);
  }

  return { ok: true, version, applied };
}
