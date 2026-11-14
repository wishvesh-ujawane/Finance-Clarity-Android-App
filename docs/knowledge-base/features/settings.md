---
id: feature-settings
title: Settings landing screen
date: 2026-06-28
updated: 2026-11-14
status: current
scope: [financial-clarity]
related:
  - ./profile.md
  - ./security.md
  - ./backup-restore.md
  - ./recurring-expenses.md
  - ./categories.md
  - ./savings-goals.md
  - ./changelog.md
source-of-truth-files:
  - artifacts/financial-clarity/src/pages/Settings.tsx
---

# Settings landing screen

## User-visible behavior
Landing page that groups secondary configuration screens. A round profile
button at the top right (Google photo, initial, or person icon) opens
[Profile](./profile.md), which holds the Google account and Security. Each row
navigates to the corresponding feature: Categories, Recurring Expenses, Savings
Goals, Backup & Restore. A Support section has Send Feedback (opens
`FeedbackSheet` with WhatsApp and email options) and What's New. The app
version (`v{__APP_VERSION__}`) is shown at the bottom.

## Entry points
- Route: `/settings`.
- File: [pages/Settings.tsx](../../../artifacts/financial-clarity/src/pages/Settings.tsx).

## Interactions
- Navigation links to each secondary screen.
- Profile button links to `/settings/profile`.
- Send Feedback opens [FeedbackSheet.tsx](../../../artifacts/financial-clarity/src/components/FeedbackSheet.tsx).

## Cross-feature dependencies
- Linked screens: [categories.md](./categories.md),
  [recurring-expenses.md](./recurring-expenses.md),
  [savings-goals.md](./savings-goals.md), [security.md](./security.md),
  [backup-restore.md](./backup-restore.md), [changelog.md](./changelog.md).
