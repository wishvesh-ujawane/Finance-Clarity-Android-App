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

## Amount input (2026-08-31)
The amount field in the transaction sheet
([`TransactionSheet.tsx`](../../../artifacts/financial-clarity/src/components/TransactionSheet.tsx))
supports two things at once:

1. **Calculator expressions.** Users can type `250+75` or `10000+2500` and hit
   `=` (or Save) to evaluate. Supported operators: `+`, `-`, `x`, `/`.
   Evaluated by `evaluateAmountExpression` inside the same file. The
   calculator keypad buttons preserve input focus via `preventDefault` on
   pointer/mouse/touch down so the soft keyboard stays open — see
   [bugs/20260705-tx-keypad-dismissal.md](../bugs/20260705-tx-keypad-dismissal.md).
2. **Live Indian-style comma grouping.** As the user types, each numeric
   segment is displayed with `1,23,456`-style grouping (last 3 digits, then
   groups of 2). Operators are preserved: typing `10000+2500` shows
   `10,000+2,500`. Decimals are preserved: typing `1234.56` shows `1,234.56`.

The `amount` React state is always stored **raw** (no commas). The display
value is derived via `formatAmountExpression(amount)` from
[`finance-utils.ts`](../../../artifacts/financial-clarity/src/lib/finance-utils.ts),
which delegates each numeric segment to `formatIndianDigits`. Cursor position
is preserved across re-formats by counting non-comma characters in the input
before the cursor, then walking the formatted display to find the equivalent
position — restored in a `useLayoutEffect` before paint. The calculator
buttons also set the cursor to end-of-string after each key.

## Cross-feature dependencies
- [budgets.md](./budgets.md) — spending categories drive budget progress bars.
- [recurring-expenses.md](./recurring-expenses.md) — auto-created transactions
  appear here on their scheduled day.
