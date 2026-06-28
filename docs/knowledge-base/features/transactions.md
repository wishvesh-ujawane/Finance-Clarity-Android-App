---
id: feature-transactions
title: Transactions screen + entry sheet
date: 2026-06-28
updated: 2026-06-28
status: current
scope: [financial-clarity]
related:
  - ./dashboard.md
  - ./categories.md
  - ./fab.md
source-of-truth-files:
  - artifacts/financial-clarity/src/pages/Transactions.tsx
  - artifacts/financial-clarity/src/components/TransactionSheet.tsx
  - artifacts/financial-clarity/src/context/FinanceContext.tsx
---

# Transactions screen + entry sheet

## User-visible behavior
List of all transactions for the selected month, grouped chronologically.
Tapping a row opens the entry sheet pre-filled for editing. The
[TransactionSheet](../../../artifacts/financial-clarity/src/components/TransactionSheet.tsx)
is a Framer Motion bottom sheet (slide-up) for creating or editing a
transaction.

## Entry points
- Route: `/transactions`.
- File: [pages/Transactions.tsx](../../../artifacts/financial-clarity/src/pages/Transactions.tsx).
- FAB: opens the sheet in create mode.

## State & data sources
Reads `transactions`, `categories`, `selectedMonth` from
[FinanceContext](../../../artifacts/financial-clarity/src/context/FinanceContext.tsx);
writes via the context's add / update / delete actions.

## Interactions
- **Create** — FAB → sheet → fill amount + category + (optional) note + date →
  Save.
- **Inline category creation** — the category select in the sheet allows
  creating a new category on-the-fly. See [categories.md](./categories.md).
- **Edit** — tap a row → sheet opens with current values → Save updates the
  transaction.
- **Delete** — delete button inside the edit sheet.

## Edge cases & empty states
- Empty month: empty-state placeholder and a hint to add a transaction.

## Cross-feature dependencies
- [budgets.md](./budgets.md) — spending categories drive budget progress bars.
- [recurring-expenses.md](./recurring-expenses.md) — auto-created transactions
  appear here on their scheduled day.
