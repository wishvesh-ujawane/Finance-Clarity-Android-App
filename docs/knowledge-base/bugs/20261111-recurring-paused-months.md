---
id: bug-20261111-recurring-paused-months
title: Recurring rules replayed paused months and used fuzzy occurrence matching
date: 2026-11-11
updated: 2026-11-11
status: fixed
scope: [financial-clarity, recurring-expenses, backup]
related:
  - ../decisions/0004-recurring-occurrence-identity.md
  - ../../testing.md
source-of-truth-files:
  - artifacts/financial-clarity/src/context/FinanceContext.tsx
  - artifacts/financial-clarity/src/lib/recurring-utils.ts
  - artifacts/financial-clarity/src/lib/types.ts
  - artifacts/financial-clarity/src/lib/backup.ts
---

# Recurring rules replayed paused months and used fuzzy occurrence matching

## Symptom

Resuming a rule with a start month two months in the past generated
transactions for earlier paused months. Playwright reproduced a paused rule
starting in September; resuming in November created September, October, and
November entries.

## Root cause

Paused rules were ignored without advancing `lastGeneratedMonth`. Resume
therefore restarted catch-up from the stale cursor. Deduplication also used
description, amount, category, and month instead of a stable occurrence key.
That could suppress a legitimate expense or fail after a generated entry was
edited.

## Fix

- Resume advances the cursor through due months strictly before the resume
  date; the cursor never moves backwards.
- Occurrences use the transaction key pair `recurringRuleId` and
  `recurringMonth`. Due-date comparison uses the clamped last day in short
  months.
- Backup schema v4 adds the optional pair and upgrades v1–v3 backups without
  rewriting old transactions. A narrow exact-date match remains for legacy
  generated rows left behind by interrupted pre-v4 writes.

## Tests

- [recurring-utils.test.ts](../../../artifacts/financial-clarity/src/lib/__tests__/recurring-utils.test.ts)
- [persist-first.test.tsx](../../../artifacts/financial-clarity/src/context/__tests__/persist-first.test.tsx)
- [backup.test.ts](../../../artifacts/financial-clarity/src/lib/__tests__/backup.test.ts)
- [storage-failures.pw.ts](../../../artifacts/financial-clarity/e2e/storage-failures.pw.ts), REC-002

Focused validation on 2026-11-11: the helper, context, and backup suites passed;
REC-002 passed in desktop Chromium. Android verification remains outstanding.

## Lessons

Occurrence identity belongs to each generated transaction, not to the
description or other editable transaction fields. Resume cursor movement must
be part of the persisted state change.