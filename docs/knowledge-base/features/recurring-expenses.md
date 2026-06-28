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
