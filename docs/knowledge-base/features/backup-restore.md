---
id: feature-backup-restore
title: Backup & Restore
date: 2026-06-28
updated: 2026-11-12
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
  - artifacts/financial-clarity/src/components/CsvImportPreviewDialog.tsx
  - artifacts/financial-clarity/src/components/BackupOverwriteDialog.tsx
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
- **Back up now (Drive)** — if the Drive backup has more transactions than
  this device, or cannot be read,
  [BackupOverwriteDialog.tsx](../../../artifacts/financial-clarity/src/components/BackupOverwriteDialog.tsx)
  asks first. On confirm, the current Drive file is saved as
  `finance-clarity-backup.pre-overwrite-<timestamp>.json`; if that copy fails,
  nothing is replaced. Auto-backup never replaces a larger backup and shows
  "Auto-backup paused" instead.
- **Restore from file** → opens
  [RestorePreviewDialog.tsx](../../../artifacts/financial-clarity/src/components/RestorePreviewDialog.tsx)
  showing a diff summary; user must confirm before the payload overwrites
  local storage.
- **Connect Drive** — banner CTA initiates the OAuth / Capacitor flow.
- **CSV export** — writes Date, Category, Amount, Note, Type. Cells starting
  with `=`, `+`, `-`, `@`, tab, or carriage return get a leading `'` so
  spreadsheets do not run them as formulas.
- **CSV import** — parses the file, skips invalid rows (impossible dates,
  bad amounts, missing category, unknown type) with their line numbers, and
  shows [CsvImportPreviewDialog.tsx](../../../artifacts/financial-clarity/src/components/CsvImportPreviewDialog.tsx)
  with new, duplicate, and invalid counts plus categories it would create.
  Nothing is written until the user confirms. Expense rows match an existing
  savings, commitment, expense, or "both" category by name (in that order),
  so a round-trip keeps savings as savings. Files over 5 MB are refused.
  CSV holds transactions only and is not a full backup.

## Edge cases
- Hash mismatch: restore is blocked and an error surfaces in the preview
  dialog.
- Restoring an older payload may downgrade or invalidate
  [security.md](./security.md) PIN state — flagged to the user.
- Backup schema is v5 (ADR 0006): categories carry `active`, budgets always
  have a month. v1–v4 files migrate forward; v6 or newer is refused with
  "Update the app". `appVersion` comes from the build version.
- Restore writes every key through `writeStorageEntries` and returns a typed
  failure; on failure every key is rolled back and the app does not reload.
- If local storage can't be read, no backup is built (it would be empty).

## Cross-feature dependencies
- Every persistence-touching feature is potentially overwritten on restore.
