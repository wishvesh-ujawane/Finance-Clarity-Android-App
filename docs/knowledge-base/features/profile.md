---
id: feature-profile
title: Profile (Google account and security)
date: 2026-11-14
updated: 2026-11-14
status: current
scope: [financial-clarity]
related:
  - ./settings.md
  - ./security.md
  - ./backup-restore.md
source-of-truth-files:
  - artifacts/financial-clarity/src/pages/Profile.tsx
  - artifacts/financial-clarity/src/components/ProfileAvatar.tsx
  - artifacts/financial-clarity/src/context/BackupContext.tsx
  - artifacts/financial-clarity/src/lib/googleAuth.ts
---

# Profile (Google account and security)

## User-visible behavior
A Settings sub-page titled "Profile". Top to bottom:

1. **Google account** card.
   - Signed in: large avatar (Google photo, or the first letter if the photo fails), name, and email from Google. A caption says name and photo are changed in the Google account. Buttons: **Refresh from Google** and **Disconnect Google**, with a caption that local data and Drive backups are kept.
   - Signed out: person-icon avatar, "You're not signed in", a sentence saying sign-in shows name and photo and enables Drive backup, and **Sign in with Google**. The app works fully without signing in.
2. **Security** section: one row, "App Lock & Security", with live lock and biometric status, linking to `/settings/security`.

## Trigger / entry points
- Round profile button at the top right of Settings (`settings-profile-link`).
- "Connected as…" row on the Backup & Restore Drive card.
- Route: `/settings/profile`.

## State & data sources
- `useBackup()` provides `user`, `isSignedIn`, `status`, `signIn`, and `signOut`. Profile data comes from Google sign-in and is cached in `financial-clarity:google-user` (display only, API.md §3.4). No new storage key.
- `useSecurity()` provides the lock and biometric status for the Security row.

## Interactions
- **Sign in / Refresh from Google:** both call `signIn()`, which opens Google sign-in and returns the current profile. If a different account is chosen, `BackupContext` clears the Drive folder cache and remote backup info first.
- **Disconnect Google:** calls `signOut()`. Local state is cleared even if Google does not confirm the sign-out.
- The pressed button shows a busy label. All account buttons are disabled while one runs or while a backup, restore, or Drive check is running.

## Edge cases & empty states
- Offline: shows "You're offline…" and does not start sign-in.
- Prompt cancelled: no message (`isSignInCancelled`).
- Sign-in failure: inline alert saying data is safe; raw Google codes are not shown.
- Photo fails to load: falls back to the initial.
- Photo URL not on `https://*.googleusercontent.com`: not loaded; the initial is shown (ADR-0011).

## Cross-feature dependencies
- Security (moved here from the Settings list; its back button returns to Profile).
- Backup & Restore (same Google session; the Drive card links here).
- Onboarding sign-in shares `isSignInCancelled`.

## Related changes
Owner request 2026-11-14. Owner choices: name and photo are read-only from Google with a refresh action, with no external link; account details and Disconnect moved from the Backup card; Security moved from the Settings list; signed-out users see a sign-in card, with no automatic prompt. DESIGN §5.21, §13.17. Photo host approved in [ADR-0011](../decisions/0011-google-profile-photo-host.md). What's New entry dated 2026-11-14.
