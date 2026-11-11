/**
 * Startup storage check (ARCHITECTURE §6.1): run pending migrations, then read
 * finance data, before any context mounts. Problems are returned so the app
 * can explain them full-screen instead of starting with empty data.
 */
import { readFinanceData, type QuarantineReport, type StoredFinanceData } from './finance-read';
import { runLocalMigrations, type LocalMigration, LOCAL_MIGRATIONS } from './migrations';

export interface FinanceLoad {
  data: StoredFinanceData;
  quarantined: QuarantineReport[];
}

export type StartupProblem =
  | 'unavailable'
  | 'storage-full'
  | 'newer-version'
  | 'migration-failed'
  /** Invalid data was found but its raw copy could not be saved. */
  | 'unpreserved';

export type StorageStartupResult =
  | { ok: true; load: FinanceLoad }
  | { ok: false; problem: Exclude<StartupProblem, 'unpreserved'> }
  | { ok: false; problem: 'unpreserved'; load: FinanceLoad };

export function prepareStorage(migrations: readonly LocalMigration[] = LOCAL_MIGRATIONS): StorageStartupResult {
  const migration = runLocalMigrations(migrations);
  if (!migration.ok) {
    switch (migration.error) {
      case 'unavailable':
        return { ok: false, problem: 'unavailable' };
      case 'quota':
        return { ok: false, problem: 'storage-full' };
      case 'newer-version':
        return { ok: false, problem: 'newer-version' };
      default:
        return { ok: false, problem: 'migration-failed' };
    }
  }

  const read = readFinanceData();
  if (!read.ok) return { ok: false, problem: 'unavailable' };
  const load: FinanceLoad = { data: read.data, quarantined: read.quarantined };
  if (read.quarantined.some(r => !r.preserved)) return { ok: false, problem: 'unpreserved', load };
  return { ok: true, load };
}
