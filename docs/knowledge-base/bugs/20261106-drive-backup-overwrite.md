---
id: bug-20261106-drive-backup-overwrite
title: Back up now could replace a larger Drive backup with an empty or smaller one
date: 2026-11-06
updated: 2026-11-06
status: fixed
scope: [financial-clarity, backup-restore]
related:
  - ../features/backup-restore.md
  - ../../audits/2026-11-06-e2e-browser-audit.md
source-of-truth-files:
  - artifacts/financial-clarity/src/context/BackupContext.tsx
  - artifacts/financial-clarity/src/components/BackupSettingsCard.tsx
  - artifacts/financial-clarity/src/components/BackupOverwriteDialog.tsx
---

# Back up now could replace a larger Drive backup with an empty or smaller one

## Symptom
Found by code review in the [2026-11-06 browser audit](../../audits/2026-11-06-e2e-browser-audit.md) (F-05):
after a reinstall, tapping **Back up now** before restoring replaced the only
Drive backup with the empty local data. There is one backup file per account,
and no copy was kept before overwriting (only before a restore).

## Root cause
`backupNow` uploaded over the existing file id without looking at what that
file contained.

## Fix
- `backupNow(options)` reads the Drive file's transaction count (metadata, or
  download and validate when metadata is missing). If Drive has more
  transactions than the device, or the file cannot be read, it returns
  `{ status: 'needs-confirmation', ... }` without uploading.
- With `{ replaceLargerBackup: true }` it first uploads the current Drive file
  as `finance-clarity-backup.pre-overwrite-<timestamp>.json`; if that fails,
  it stops with "was not replaced".
- Auto-backup treats `needs-confirmation` as a paused backup and records
  "Auto-backup paused…" in `lastAutoBackupError`.
- `BackupSettingsCard` shows `BackupOverwriteDialog` with both counts and
  advises restoring after a reinstall.

## Tests
- [BackupContext.test.tsx](../../../artifacts/financial-clarity/src/context/__tests__/BackupContext.test.tsx) — asks
  before replacing, snapshot-before-upload order, failed snapshot aborts,
  smaller remote replaced without asking, unreadable remote asks, auto-backup
  pauses. Drive and Google auth are mocked; no device or Drive run yet.

## Lessons
A single-slot backup needs a guard on the write path, not only on restore.
