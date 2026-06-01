// Persistence helpers for the first-time user onboarding flow.
//
// We migrate users who completed the older FirstLaunchRestoreModal flow
// (which wrote `financial-clarity:first-run-done`) so they are not
// re-onboarded by the new journey.

const ONBOARDING_FLAG = 'financial-clarity:onboarding-complete';
const LEGACY_FLAG = 'financial-clarity:first-run-done';
const TRANSACTIONS_KEY = 'financial-clarity:transactions';

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function safeSet(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

function hasExistingTransactions(): boolean {
  const raw = safeGet(TRANSACTIONS_KEY);
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return false;
  }
}

export function isOnboardingComplete(): boolean {
  if (safeGet(ONBOARDING_FLAG)) return true;

  // Legacy users (modal already dismissed) — migrate silently.
  if (safeGet(LEGACY_FLAG)) {
    safeSet(ONBOARDING_FLAG, 'migrated:legacy-flag');
    return true;
  }

  // Existing users with real data who never saw any modal — treat as done.
  if (hasExistingTransactions()) {
    safeSet(ONBOARDING_FLAG, 'migrated:has-data');
    return true;
  }

  return false;
}

export function markOnboardingComplete(reason: string = 'completed') {
  safeSet(ONBOARDING_FLAG, `${reason}:${Date.now()}`);
}

// Connect-Drive nudge banner shown on the Dashboard after a "Skip" finish.
const BANNER_DISMISSED_KEY = 'financial-clarity:connect-drive-banner-dismissed';

export function isConnectDriveBannerDismissed(): boolean {
  return Boolean(safeGet(BANNER_DISMISSED_KEY));
}

export function dismissConnectDriveBanner() {
  safeSet(BANNER_DISMISSED_KEY, String(Date.now()));
}
