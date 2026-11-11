---
id: bug-20261106-swallowed-storage-writes
title: Failed saves looked successful because finance writes ran after state changes and ignored errors
date: 2026-11-06
updated: 2026-11-11
status: fixed
scope: [financial-clarity, storage]
related:
  - ../../audits/2026-11-06-e2e-browser-audit.md
  - ../../audits/2026-11-06-cleanup-phases-3-4-review.md
source-of-truth-files:
  - artifacts/financial-clarity/src/lib/storage/finance-storage.ts
  - artifacts/financial-clarity/src/context/FinanceContext.tsx
  - artifacts/financial-clarity/src/components/TransactionSheet.tsx
  - artifacts/financial-clarity/src/pages/Categories.tsx
  - artifacts/financial-clarity/src/pages/BackupRestore.tsx
  - artifacts/financial-clarity/src/components/month-end/MonthEndReconcileCard.tsx
  - artifacts/financial-clarity/src/App.tsx
---

# Failed saves looked successful because finance writes ran after state changes and ignored errors

## Symptom
Audit F-08 (also P4-1 in the [phase 3–4 review](../../audits/2026-11-06-cleanup-phases-3-4-review.md)):
when phone storage is full, adding or editing an entry appeared to work, but
the change was gone after restarting the app.

## Root cause
`FinanceProvider` updated React state first and wrote each key later in a
`useEffect` through `saveToStorage`, whose `catch` ignored every error.
Multi-key operations (recurring generation, reconciliation) wrote each key
independently, so a failure could leave them half-saved.

## Fix
- **E1:** `lib/storage/finance-storage.ts` — one list of finance keys (names
  unchanged), `writeStorageEntries` / `writeFinanceData` with typed results
  (`quota` / `unavailable`), DATABASE §7.3 write order, and rollback of every
  key already written when a later write fails.
- **E2:** `FinanceContext.commit()` saves first and updates React state only
  on success; a `latest` ref prevents stale reads between consecutive writes.
  Converted: add/import/update/delete transaction, add/update/delete category,
  recurring generation (transactions + cursors), reconciliation (adjustment +
  record). These return `{ ok }` or `{ ok: false, message }`.
  - Transaction sheet, Categories, CSV import, and the month-end reconcile
    step show the message inline and keep entered values.
  - Background failures set `storageError`, shown as a toast by `App.tsx`.
- **E3:** budgets, recurring rules, and savings targets now use `commit()`;
  their UI keeps values and reports failures. Non-finance preference writes
  remain outside the finance entity boundary.

## Tests
- [finance-storage.test.ts](../../../artifacts/financial-clarity/src/lib/storage/__tests__/finance-storage.test.ts)
- [persist-first.test.tsx](../../../artifacts/financial-clarity/src/context/__tests__/persist-first.test.tsx) — all finance mutation domains.
- [storage-failures.pw.ts](../../../artifacts/financial-clarity/e2e/storage-failures.pw.ts) — STO-001–004.

Focused validation on 2026-11-11: 22/22 Vitest tests passed across the
persist-first, recurring utility, and backup suites; STO-002–004 also passed
in desktop Chromium.

## Lessons
Writing in a `useEffect` after `setState` can never report failure to the
user in time; the save has to happen before the state change.
