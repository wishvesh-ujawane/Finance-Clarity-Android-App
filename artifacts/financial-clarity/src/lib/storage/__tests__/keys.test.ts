import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { monthReviewKey, quarantineKey, quarantineKeyPrefix, STORAGE_KEY_PREFIX, STORAGE_KEYS } from '../keys';

const srcRoot = path.resolve(import.meta.dirname, '..', '..', '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === '__tests__' ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

describe('storage key catalogue', () => {
  it('keeps every existing key name unchanged (DATABASE §3)', () => {
    expect(STORAGE_KEYS).toEqual({
      transactions: 'financial-clarity:transactions',
      categories: 'financial-clarity:categories',
      budgets: 'financial-clarity:budgets',
      recurring: 'financial-clarity:recurring',
      reconciliations: 'financial-clarity:reconciliations',
      savingsGoal: 'financial-clarity:savings-goal',
      security: 'financial-clarity:security',
      backupPrefs: 'financial-clarity:backup-prefs',
      driveFolderCache: 'financial-clarity:backup-folder-id',
      googleUser: 'financial-clarity:google-user',
      onboardingComplete: 'financial-clarity:onboarding-complete',
      legacyFirstRunDone: 'financial-clarity:first-run-done',
      connectDriveBannerDismissed: 'financial-clarity:connect-drive-banner-dismissed',
      storageVersion: 'financial-clarity:storage-version',
      smsPending: 'financial-clarity:sms-pending',
      smsDismissed: 'financial-clarity:sms-dismissed',
      smsLinked: 'financial-clarity:sms-linked',
      smsLastScan: 'financial-clarity:sms-last-scan',
    });
    expect(monthReviewKey('2026-06')).toBe('financial-clarity:month-end-review:2026-06');
  });

  it('builds quarantine keys in the existing format', () => {
    expect(quarantineKey(STORAGE_KEYS.savingsGoal, 1_700_000_000_000)).toBe(
      'financial-clarity:backup:savings-goal:1700000000000',
    );
    expect(quarantineKeyPrefix(STORAGE_KEYS.transactions)).toBe('financial-clarity:backup:transactions:');
  });

  it('is the only source file with key string literals (ARCHITECTURE §8.2)', () => {
    const withoutComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const offenders = sourceFiles(srcRoot)
      .filter(file => !file.endsWith(path.join('storage', 'keys.ts')))
      .filter(file => new RegExp(`[\`'"]${STORAGE_KEY_PREFIX}`).test(withoutComments(readFileSync(file, 'utf-8'))))
      .map(file => path.relative(srcRoot, file));
    expect(offenders).toEqual([]);
  });
});
