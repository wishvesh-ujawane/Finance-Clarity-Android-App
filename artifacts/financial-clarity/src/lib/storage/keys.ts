/**
 * Storage key catalogue (DATABASE §3). Every `localStorage` key name lives
 * here. The `financial-clarity:` prefix and every value are frozen: renaming
 * one strands existing user data (PRD FR-01).
 */

export const STORAGE_KEY_PREFIX = 'financial-clarity:';

export const STORAGE_KEYS = {
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
} as const;

const MONTH_REVIEW_KEY_PREFIX = 'financial-clarity:month-end-review:';
const QUARANTINE_KEY_PREFIX = 'financial-clarity:backup:';

/** Per-month review state key, for example `financial-clarity:month-end-review:2026-06`. */
export function monthReviewKey(month: string): string {
  return `${MONTH_REVIEW_KEY_PREFIX}${month}`;
}

/** Prefix shared by every quarantine copy of `key` (a full key from `STORAGE_KEYS`). */
export function quarantineKeyPrefix(key: string): string {
  return `${QUARANTINE_KEY_PREFIX}${key.slice(STORAGE_KEY_PREFIX.length)}:`;
}

/** Quarantine copy of `key`: `financial-clarity:backup:<name>:<epoch_ms>` (DATABASE §3). */
export function quarantineKey(key: string, epochMs: number): string {
  return `${quarantineKeyPrefix(key)}${epochMs}`;
}
