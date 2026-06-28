---
id: feature-backup-restore
title: Backup & Restore
date: 2026-06-28
updated: 2026-06-28
status: current
scope: [financial-clarity]
related:
  - ./settings.md
  - ./security.md
source-of-truth-files:
  - artifacts/financial-clarity/src/pages/BackupRestore.tsx
  - artifacts/financial-clarity/src/context/BackupContext.tsx
  - artifacts/financial-clarity/src/components/BackupSettingsCard.tsx
  - artifacts/financial-clarity/src/components/RestorePreviewDialog.tsx
  - artifacts/financial-clarity/src/components/ConnectDriveBanner.tsx
  - artifacts/financial-clarity/src/lib/backup.ts
  - artifacts/financial-clarity/src/lib/backupHash.ts
  - artifacts/financial-clarity/src/lib/csv.ts
---

# Backup & Restore

## User-visible behavior
Lets the user back up and restore their local data (transactions, categories,
budgets, recurring expenses, savings, settings) as a single file. A "Connect
Drive" banner promotes cloud backup on supported platforms. A restore preview
dialog shows what will change before committing.

## Entry points
- Route: `/backup-restore` (linked from Settings).
- File: [pages/BackupRestore.tsx](../../../artifacts/financial-clarity/src/pages/BackupRestore.tsx).
- Drive banner:
  [ConnectDriveBanner.tsx](../../../artifacts/financial-clarity/src/components/ConnectDriveBanner.tsx)
  surfaces on Dashboard and Settings when Drive is not yet connected.

## State & data sources
[BackupContext.tsx](../../../artifacts/financial-clarity/src/context/BackupContext.tsx)
orchestrates backup creation, restore preview, restore commit, and Drive
connection state.

## Library helpers
- [lib/backup.ts](../../../artifacts/financial-clarity/src/lib/backup.ts) —
  serialize / deserialize the full backup payload.
- [lib/backupHash.ts](../../../artifacts/financial-clarity/src/lib/backupHash.ts)
  — integrity hash to detect tampering / corruption.
- [lib/csv.ts](../../../artifacts/financial-clarity/src/lib/csv.ts) — CSV
  import / export for transactions.

## Interactions
- **Create backup** → produces a downloadable file (and optionally uploads to
  Drive if connected).
- **Restore from file** → opens
  [RestorePreviewDialog.tsx](../../../artifacts/financial-clarity/src/components/RestorePreviewDialog.tsx)
  showing a diff summary; user must confirm before the payload overwrites
  local storage.
- **Connect Drive** — banner CTA initiates the OAuth / Capacitor flow.

## Edge cases
- Hash mismatch: restore is blocked and an error surfaces in the preview
  dialog.
- Restoring an older payload may downgrade or invalidate
  [security.md](./security.md) PIN state — flagged to the user.

## Cross-feature dependencies
- Every persistence-touching feature is potentially overwritten on restore.
