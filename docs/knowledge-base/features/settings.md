---
id: feature-settings
title: Settings landing screen
date: 2026-06-28
updated: 2026-06-28
status: current
scope: [financial-clarity]
related:
  - ./security.md
  - ./backup-restore.md
  - ./recurring-expenses.md
  - ./categories.md
  - ./savings-goals.md
source-of-truth-files:
  - artifacts/financial-clarity/src/pages/Settings.tsx
---

# Settings landing screen

## User-visible behavior
Landing page that groups secondary configuration screens. Each row navigates
to the corresponding feature: Categories, Recurring Expenses, Savings Goals,
Security, Backup & Restore.

## Entry points
- Route: `/settings`.
- File: [pages/Settings.tsx](../../../artifacts/financial-clarity/src/pages/Settings.tsx).

## Interactions
- Navigation links to each secondary screen.

## Cross-feature dependencies
- Linked screens: [categories.md](./categories.md),
  [recurring-expenses.md](./recurring-expenses.md),
  [savings-goals.md](./savings-goals.md), [security.md](./security.md),
  [backup-restore.md](./backup-restore.md).
