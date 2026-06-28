---
id: feature-recurring-expenses
title: Recurring Expenses screen
date: 2026-06-28
updated: 2026-06-28
status: current
scope: [financial-clarity]
related:
  - ./transactions.md
  - ./settings.md
  - ./fab.md
  - ./budgets.md
  - ./analysis.md
  - ../decisions/0002-canonical-budget-summary.md
source-of-truth-files:
  - artifacts/financial-clarity/src/pages/RecurringExpenses.tsx
  - artifacts/financial-clarity/src/context/FinanceContext.tsx
---

# Recurring Expenses screen

## User-visible behavior
Manages monthly auto-added transactions. Header: back button → `/settings`,
labels "Settings · Recurring Expenses". Info line: "Active recurring items
automatically add a transaction every month on the chosen day."

Inline form (shown on Add or Edit) collects:
- Description, Amount (₹ prefix), Category select.
- Grid: Day of month (1–31) + Start month.
- Active checkbox.
- Cancel / Save buttons.

Each list item shows category icon, description, category name, day of month,
start month, amount (bold), and an Active / Paused badge plus
Pause-or-Resume / Edit / Delete (with confirmation) buttons.

## Entry points
- Route: `/recurring` (linked from Settings).
- File: [pages/RecurringExpenses.tsx](../../../artifacts/financial-clarity/src/pages/RecurringExpenses.tsx).
- FAB action: `useFabAction(beginAdd, 'Add recurring expense', 'fab-add-recurring')`.

## State & data sources
`recurringExpenses` collection on
[FinanceContext](../../../artifacts/financial-clarity/src/context/FinanceContext.tsx).

## Edge cases & empty states
- Empty: plus-icon tile + "No recurring expenses yet".
- Pause: hides the item from monthly auto-creation without deleting it.

## Cross-feature dependencies
- [transactions.md](./transactions.md) — each active recurring item creates a
  transaction on its scheduled day.
- [categories.md](./categories.md) — required for category select.

## Materialised recurring transactions are ordinary expenses

Once a recurring item materialises for a given month it becomes a normal
`Transaction` row on
[FinanceContext](../../../artifacts/financial-clarity/src/context/FinanceContext.tsx)
with `type === 'expense'`. It has no flag marking it as "recurring-derived",
so all downstream math treats it exactly like a hand-entered expense:

- It counts toward `BudgetSummary.spentOnBudgeted` when its category has a
  budget for the month (see [budgets.md → Math](./budgets.md#math) and
  [ADR-0002](../decisions/0002-canonical-budget-summary.md)).
- It counts toward `BudgetSummary.commitmentsFullMonth` **iff** its category
  has `type === 'commitment'` — the recurring/non-recurring distinction is
  irrelevant; only category type matters.
- It is included in full-month totals immediately upon materialisation, even
  if its `date` is later in the month. To-date variants
  (`monthlyExpensesToDate`, `monthlyCommitmentsToDate` in
  [useAnalysisShared](../../../artifacts/financial-clarity/src/components/analysis/useAnalysisShared.ts))
  filter by `date <= today` and therefore exclude future-dated recurring
  rows until their day arrives.
