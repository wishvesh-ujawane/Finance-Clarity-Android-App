---
id: feature-security
title: Security (PIN + biometric lock)
date: 2026-06-28
updated: 2026-11-06
status: current
scope: [financial-clarity]
related:
  - ./settings.md
  - ./onboarding.md
source-of-truth-files:
  - artifacts/financial-clarity/src/pages/Security.tsx
  - artifacts/financial-clarity/src/context/SecurityContext.tsx
  - artifacts/financial-clarity/src/components/LockScreen.tsx
  - artifacts/financial-clarity/src/components/PinSetupDialog.tsx
  - artifacts/financial-clarity/src/lib/biometric.ts
  - artifacts/financial-clarity/src/lib/security.ts
  - artifacts/financial-clarity/src/lib/screen-security.ts
  - artifacts/financial-clarity/android/app/src/main/java/com/bytetobrain/fiscalfocus/ScreenSecurityPlugin.java
---

# Security (PIN + biometric lock)

## User-visible behavior
Gates the app behind a 4-/6-digit PIN and (when available) device biometrics.
The Security settings screen lets the user enable / disable the lock, change
the PIN, and toggle biometrics.

## Entry points
- Route: `/security` (linked from Settings).
- File: [pages/Security.tsx](../../../artifacts/financial-clarity/src/pages/Security.tsx).
- Lock screen overlay:
  [LockScreen.tsx](../../../artifacts/financial-clarity/src/components/LockScreen.tsx)
  rendered by `App.tsx` when `SecurityContext` reports a locked state.
- PIN setup:
  [PinSetupDialog.tsx](../../../artifacts/financial-clarity/src/components/PinSetupDialog.tsx).

## State & data sources
[SecurityContext.tsx](../../../artifacts/financial-clarity/src/context/SecurityContext.tsx)
holds lock state, PIN hash, biometric-enabled flag, and unlock helpers.

## Interactions
- **Set PIN** (first time) — open `PinSetupDialog` → enter PIN twice → store
  hash.
- **Change PIN** — re-open dialog, requires current PIN.
- **Enable biometrics** — uses
  [lib/biometric.ts](../../../artifacts/financial-clarity/src/lib/biometric.ts)
  which wraps the Capacitor biometric plugin.
- **Unlock** — `LockScreen` accepts PIN entry or biometric prompt.
- **While locked** — `App.tsx` renders only `LockScreen`: no page, navigation,
  sheet, FAB, month-end flow, or toast is mounted. Keyboard focus stays inside
  the lock screen.
- **Failed attempts** — stored in the security settings as `failedAttempts`
  and `cooldownUntil`, so restarting the app keeps the cooldown. Every fifth
  consecutive failure starts a cooldown of 30 s, then 1 min, 5 min, and 15 min
  (maximum). PIN and biometric unlock are refused during a cooldown. A
  successful unlock clears both fields.
- **Recents and screenshots** — while the app lock is enabled, the local
  `ScreenSecurity` plugin sets Android `FLAG_SECURE`: the app is blank in the
  recent-apps screen and screenshots are blocked. Disabling the lock clears it.

## Edge cases
- Biometric unavailable: option is hidden / disabled and the user can only use
  a PIN.
- Backup restore (see [backup-restore.md](./backup-restore.md)) may invalidate
  the PIN if the restored payload predates the current PIN setup.
