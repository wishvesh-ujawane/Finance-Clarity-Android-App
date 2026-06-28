---
id: feature-security
title: Security (PIN + biometric lock)
date: 2026-06-28
updated: 2026-06-28
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

## Edge cases
- Biometric unavailable: option is hidden / disabled and the user can only use
  a PIN.
- Backup restore (see [backup-restore.md](./backup-restore.md)) may invalidate
  the PIN if the restored payload predates the current PIN setup.
