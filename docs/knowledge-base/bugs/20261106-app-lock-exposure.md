---
id: bug-20261106-app-lock-exposure
title: Locked app kept financial screens mounted; cooldown reset on restart; no Recents protection
date: 2026-11-06
updated: 2026-11-06
status: fixed
scope: [financial-clarity, security]
related:
  - ../features/security.md
  - ../../audits/2026-11-06-e2e-browser-audit.md
source-of-truth-files:
  - artifacts/financial-clarity/src/App.tsx
  - artifacts/financial-clarity/src/components/LockScreen.tsx
  - artifacts/financial-clarity/src/context/SecurityContext.tsx
  - artifacts/financial-clarity/src/lib/security.ts
  - artifacts/financial-clarity/src/lib/screen-security.ts
  - artifacts/financial-clarity/android/app/src/main/java/com/bytetobrain/fiscalfocus/ScreenSecurityPlugin.java
  - artifacts/financial-clarity/android/app/src/main/java/com/bytetobrain/fiscalfocus/MainActivity.java
---

# Locked app kept financial screens mounted; cooldown reset on restart; no Recents protection

## Symptom
Found in the [2026-11-06 browser audit](../../audits/2026-11-06-e2e-browser-audit.md) (F-04, F-09, F-13):

- With the app locked on the Dashboard, the balance was present in the page
  and the accessibility tree under a 95%-opaque overlay.
- Pressing Tab moved focus out of the lock screen into the hidden app.
- After five wrong PINs, reloading the app cleared the 30-second cooldown.
- Without `FLAG_SECURE`, balances showed in Android's recent-apps thumbnail.

## Root cause
- `AppLayout` always rendered the routes, sheets, and navigation; only the
  FAB and month-end flow checked `isLocked`. `LockScreen` was an overlay.
- Attempts and cooldown lived in `LockScreen` React state.
- `ARCHITECTURE §15.3` listed `FLAG_SECURE` as a pending owner decision.

## Fix
- `App.tsx` returns only `LockScreen` while locked; the toaster is hidden too.
- `LockScreen` traps Tab focus and reads the cooldown from settings; the
  overlay is now fully opaque.
- `security.ts` adds `withFailedAttempt`, `withoutFailedAttempts`, and
  `isInCooldown`, storing `failedAttempts` and `cooldownUntil` in the existing
  security settings key (DATABASE §4.8). Escalation: 30 s, 1 min, 5 min,
  15 min. Damaged optional fields are dropped rather than disabling the lock.
- `SecurityContext` records each unlock result, refuses PIN and biometric
  unlock during a cooldown, and calls `setScreenSecure` whenever the app lock
  is turned on or off.
- New local Android plugin `ScreenSecurityPlugin` (registered in
  `MainActivity`) adds or clears `FLAG_SECURE`. Owner decision 2026-11-06:
  only while the app lock is enabled.

## Tests
- [security.test.ts](../../../artifacts/financial-clarity/src/lib/__tests__/security.test.ts) — escalation,
  expiry, clearing, persistence, damaged fields.
- [SecurityContext.test.tsx](../../../artifacts/financial-clarity/src/context/__tests__/SecurityContext.test.tsx) — cooldown
  survives a remount; a correct PIN after expiry clears attempts.
- [audit-2026-11-06.pw.ts](../../../artifacts/financial-clarity/e2e/audit-2026-11-06.pw.ts) — SEC-004 to SEC-006 now
  pass.
- `FLAG_SECURE` needs a manual device check (see
  [BUILD_ON_HOME_PC.md](../../BUILD_ON_HOME_PC.md) §9); it cannot run in a browser.

## Lessons
- A visual overlay is not access control: anything mounted is readable by the
  DOM, screen readers, and Recents.
- Security counters belong in persisted state, never component state.
