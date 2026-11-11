---
id: bug-20261112-transaction-double-submit
title: A quick double tap on the entry sheet saved the transaction twice
date: 2026-11-12
updated: 2026-11-12
status: fixed
scope: [financial-clarity, transactions]
related:
  - ../features/transactions.md
source-of-truth-files:
  - artifacts/financial-clarity/src/components/TransactionSheet.tsx
---

# A quick double tap on the entry sheet saved the transaction twice

## Symptom

Tapping **Add Expense** twice in quick succession could save two identical
transactions. DESIGN §7.3 requires submit buttons to ignore repeated taps.

## Root cause

`handleSubmit` saved synchronously and then closed the sheet. A second click
handled before React re-rendered still had the open sheet's values, so it
saved again.

## Fix

Phase 6 (2026-11-12): `TransactionSheet` keeps a `submittingRef` that is set
on the first submit, cleared if the save fails (so the user can retry), and
reset each time the sheet opens. The budget sheet needs no guard because
`addBudget` replaces the limit for the same category and month.

## Tests

E2E TXN-002 in [journeys.pw.ts](../../../artifacts/financial-clarity/e2e/journeys.pw.ts)
clicks submit twice in one task and checks one transaction is saved. With the
guard removed, the test saves two and fails.

## Lessons

Synchronous saves still need a busy guard: event handlers can run twice
before the next render.
