---
id: bug-20261112-savings-bank-reconciliation
title: Separate savings were included in the reconciliation bank balance
date: 2026-11-12
updated: 2026-11-12
status: fixed
scope: [financial-clarity, month-end]
related:
  - ../decisions/0008-savings-reconciliation.md
  - ../features/month-end-review.md
source-of-truth-files:
  - artifacts/financial-clarity/src/lib/domain/finance-metrics.ts
  - artifacts/financial-clarity/src/components/month-end/MonthEndReconcileCard.tsx
---

# Separate savings were included in the reconciliation bank balance

## Symptom

Savings transferred to separate accounts appeared in the expected bank balance and could be mistaken for missed spending.

## Root cause

The expected-bank selector used the lifetime-style balance plus unpaid card debt, without subtracting savings held outside that bank.

## Fix

The expected-bank selector subtracts tracked combined savings. Reconcile accepts the actual combined savings balance and records only a confirmed difference, with separate handling for spending and transfers back to bank. It does not rewrite previous reconciliation records or transactions.

## Tests

The domain metric tests, `savings-reconciliation.test.tsx`, and browser cases MER-003 and MER-004 cover the calculation, correction, repeat, and save-failure paths.

## Lessons

Lifetime balance and bank cash are distinct metrics. Account transfers must not be inferred to be spending.
