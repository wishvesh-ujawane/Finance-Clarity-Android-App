---
id: feature-recurring-expenses
title: Recurring Expenses screen
date: 2026-06-28
updated: 2026-11-12
status: current
scope: [financial-clarity]
related:
  - ./transactions.md
  - ./settings.md
  - ./fab.md
  - ../decisions/0004-recurring-occurrence-identity.md
source-of-truth-files:
  - artifacts/financial-clarity/src/pages/RecurringExpenses.tsx
  - artifacts/financial-clarity/src/context/FinanceContext.tsx
  - artifacts/financial-clarity/src/lib/domain/recurring.ts
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
  Resuming skips months that fell due while paused; an occurrence due on the
  resume day is still created.
- Generation runs only while the app is unlocked: once after unlock and on
  every return to the foreground (`App.tsx` → `processRecurring`). The
  scheduler is the pure `planRecurringGeneration` in `lib/domain/recurring.ts`.
- A scheduled day that does not exist in a month uses the month's last day
  (31 → 30, 28, or 29). After time away, every missed month is added once.
- Each generated transaction carries `recurringRuleId` + `recurringMonth`
  (ADR 0004), so repeated runs never duplicate it. A deleted occurrence is not
  recreated because the cursor has passed it; permanent suppression is still a
  pending PRD FR-07 decision.
- The category picker offers active categories only (ADR 0006). A rule whose
  category became inactive keeps generating.

## Cross-feature dependencies
- [transactions.md](./transactions.md) — each active recurring item creates a
  transaction on its scheduled day.
- [categories.md](./categories.md) — required for category select.
