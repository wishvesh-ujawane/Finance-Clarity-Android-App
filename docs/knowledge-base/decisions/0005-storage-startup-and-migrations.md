---
id: decision-0005
title: ADR-0005 — Startup storage check, quarantine, and local migration runner
date: 2026-11-11
updated: 2026-11-11
status: accepted
scope: [financial-clarity, storage, migrations]
related:
  - ./0004-recurring-occurrence-identity.md
  - ../bugs/20261106-swallowed-storage-writes.md
source-of-truth-files:
  - docs/DATABASE.md
  - docs/ARCHITECTURE.md
  - docs/API.md
  - artifacts/financial-clarity/src/lib/storage/keys.ts
  - artifacts/financial-clarity/src/lib/storage/schemas.ts
  - artifacts/financial-clarity/src/lib/storage/finance-read.ts
  - artifacts/financial-clarity/src/lib/storage/migrations.ts
  - artifacts/financial-clarity/src/lib/storage/startup.ts
---

# ADR-0005 — Startup storage check, quarantine, and local migration runner

## Context

Phase 2 of the implementation plan needs a safe storage boundary before any
schema change (category `active`, budget `month`) can ship. Before this change:

- Key strings were spread across seven files, and entity validators were
  copied in `FinanceContext` and `backup.ts`.
- Quarantine copied invalid raw text, but a corrupt savings goal was dropped
  without a copy. A failed copy was ignored, so a later save could overwrite
  the only original. The same corrupt key was copied again on every launch.
  The user was never told.
- If storage could not be read, the app started with empty data, and the next
  save could overwrite real data.
- No `storage-version` key or migration runner existed.
- `applyBackup` threw instead of returning a result.

## Decision

1. One key catalogue (`lib/storage/keys.ts`) and one validator per entity
   (`lib/storage/schemas.ts`). Key values are unchanged. A unit test fails if
   another source file contains a key string.
2. `readFinanceData` reads all finance keys and quarantines anything invalid.
   The savings goal is included. An identical quarantine copy is not saved
   twice. Each report says whether the raw copy was saved.
3. `runLocalMigrations` uses `financial-clarity:storage-version` (absent = 0).
   Steps are ordered, forward-only, and idempotent. Each step's writes and its
   version are saved together through `writeStorageEntries`, version last, and
   rolled back together. A stored version newer than the app knows is refused
   and left unchanged. No step is registered yet: migration 1 (category
   `active`) ships with Phase 4 and backup v5, so the key is not written yet.
4. `prepareStorage` runs migrations, then the read, before any provider
   mounts. Problems are shown full-screen with **Try again**. When invalid
   data was found but its copy could not be saved, the screen also offers
   **Continue without it** behind an explicit confirmation, so a full store
   cannot lock the user out permanently.
5. Quarantined records are reported in a dismissible banner, with counts only.
6. `applyBackup` returns a typed result through `writeStorageEntries`.
   `buildBackup` reads through the shared reader without quarantining and
   throws rather than building an empty backup when storage is unreadable.

## Alternatives considered

- Rewrite each corrupt key with its valid subset right after quarantining.
  Rejected: it changes stored data without the user acting. The existing rule
  (do not rewrite a quarantined key at launch) is kept, and deduplication
  stops repeated copies.
- Block startup with no way forward when a quarantine copy can't be saved.
  Rejected: a full `localStorage` could make the app unusable for good.
- Register migration 2 (budget `month`) now. Deferred by the owner to ship
  with Phase 4 and backup v5.
- Route every non-finance module (security, onboarding, month-end review,
  Google profile cache, backup preferences) through the storage layer now.
  Deferred by the owner. Only their key names moved.

## Consequences

- Positive: storage problems are visible and never silently replaced by empty
  data. Migrations have a tested runner. Keys and validators have one home.
- Negative: an unreadable store now blocks startup where it used to show an
  empty app. That is the documented behavior (DESIGN §8.2).
- Behavior changes: a backup now includes a legacy single-bucket savings goal
  (converted to the two-bucket shape) instead of omitting it. Backup
  validation now also requires a savings `createdAt` to be a string when
  present, the same rule storage reads already used.
- Follow-ups: register migration 1 in Phase 4. Move non-finance storage access
  behind the storage layer in a later phase.

## Supersedes / superseded by

None.
